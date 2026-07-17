// 📁 controllers/admin/riderEarnings.js
// Rider ki monthly earnings (1% delivery + 1% return-leg) — RiderDebt (rider_guilty case) se
// net karke final payable nikalta hai, jaisa supplier-payments karta hai days ke liye.
const RiderEarning     = require("../../models/riderCompany/riderEarning");
const RiderDebt        = require("../../models/returnOrder/RiderDebt");
const DeliveryCompany  = require("../../models/riderCompany/riderCompany");

const monthKey   = (d) => new Date(d).toISOString().slice(0, 7); // "2026-07"
const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Rider Earnings, grouped by month, per rider company
//  GET /api/admin/rider-earnings/months
// ═══════════════════════════════════════════════════════
exports.getEarningMonths = async (req, res) => {
  try {
    const [earnings, debts] = await Promise.all([
      RiderEarning.find({}).populate("deliveryCompanyId", "name email phone").lean(),
      RiderDebt.find({}).populate("deliveryCompanyId", "name email phone").lean(),
    ]);

    // Group earnings by month + company
    const map = {}; // key: `${monthKey}_${companyId}`

    earnings.forEach(e => {
      const cid = e.deliveryCompanyId?._id?.toString() || "unknown";
      const mk  = monthKey(e.createdAt);
      const key = `${mk}_${cid}`;
      if (!map[key]) {
        map[key] = {
          month: mk, monthLabel: monthLabel(mk),
          companyId: cid, company: e.deliveryCompanyId,
          deliveryEarning: 0, returnLegEarning: 0, totalEarning: 0,
          debtAmount: 0, netPayable: 0,
          earningCount: 0, settled: true,
        };
      }
      const row = map[key];
      if (e.reason === "delivery")   row.deliveryEarning  += e.earningAmount || 0;
      if (e.reason === "return_leg") row.returnLegEarning += e.earningAmount || 0;
      row.totalEarning += e.earningAmount || 0;
      row.earningCount++;
      if (!e.settled) row.settled = false;
    });

    // Overlay debts (rider_guilty) into the same month+company bucket
    debts.forEach(d => {
      const cid = d.deliveryCompanyId?._id?.toString() || "unknown";
      const mk  = monthKey(d.createdAt);
      const key = `${mk}_${cid}`;
      if (!map[key]) {
        map[key] = {
          month: mk, monthLabel: monthLabel(mk),
          companyId: cid, company: d.deliveryCompanyId,
          deliveryEarning: 0, returnLegEarning: 0, totalEarning: 0,
          debtAmount: 0, netPayable: 0,
          earningCount: 0, settled: true,
        };
      }
      map[key].debtAmount += d.netOwed || 0;
      if (!d.settled) map[key].settled = false;
    });

    const result = Object.values(map)
      .map(r => ({
        ...r,
        deliveryEarning:  Math.round(r.deliveryEarning  * 100) / 100,
        returnLegEarning: Math.round(r.returnLegEarning * 100) / 100,
        totalEarning:     Math.round(r.totalEarning     * 100) / 100,
        debtAmount:       Math.round(r.debtAmount        * 100) / 100,
        netPayable:       Math.round((r.totalEarning - r.debtAmount) * 100) / 100,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));

    const overall = {
      totalEarning: Math.round(result.reduce((s, r) => s + r.totalEarning, 0) * 100) / 100,
      totalDebt:    Math.round(result.reduce((s, r) => s + r.debtAmount,   0) * 100) / 100,
      netPayable:   Math.round(result.reduce((s, r) => s + r.netPayable,   0) * 100) / 100,
    };

    res.json({ success: true, overall, total: result.length, data: result });
  } catch (err) {
    console.error("getEarningMonths error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Detail for one rider company + month
//  GET /api/admin/rider-earnings/:month/:companyId
//  month format: "2026-07"
// ═══════════════════════════════════════════════════════
exports.getEarningDetail = async (req, res) => {
  try {
    const { month, companyId } = req.params;
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end   = new Date(start); end.setMonth(end.getMonth() + 1);

    const [earnings, debts, company] = await Promise.all([
      RiderEarning.find({
        deliveryCompanyId: companyId,
        createdAt: { $gte: start, $lt: end },
      }).populate("invoiceId", "invoiceNumber grandTotal").sort({ createdAt: -1 }).lean(),
      RiderDebt.find({
        deliveryCompanyId: companyId,
        createdAt: { $gte: start, $lt: end },
      }).populate("invoiceId", "invoiceNumber grandTotal").sort({ createdAt: -1 }).lean(),
      DeliveryCompany.findById(companyId).select("name email phone"),
    ]);

    const totalEarning = earnings.reduce((s, e) => s + (e.earningAmount || 0), 0);
    const totalDebt     = debts.reduce((s, d) => s + (d.netOwed || 0), 0);

    res.json({
      success: true,
      month, monthLabel: monthLabel(month),
      company,
      summary: {
        totalEarning: Math.round(totalEarning * 100) / 100,
        totalDebt:    Math.round(totalDebt     * 100) / 100,
        netPayable:   Math.round((totalEarning - totalDebt) * 100) / 100,
      },
      earnings,
      debts,
    });
  } catch (err) {
    console.error("getEarningDetail error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Pay a rider company for a month (settle earnings + debts together)
//  POST /api/admin/rider-earnings/pay
//  Body: { month, companyId, note, transactionRef }
// ═══════════════════════════════════════════════════════
exports.payRiderEarnings = async (req, res) => {
  try {
    const { month, companyId, note, transactionRef } = req.body;
    if (!month || !companyId) {
      return res.status(400).json({ success: false, message: "month and companyId required" });
    }

    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end   = new Date(start); end.setMonth(end.getMonth() + 1);
    const now   = new Date();

    const [earningsResult, debtsResult] = await Promise.all([
      RiderEarning.updateMany(
        { deliveryCompanyId: companyId, createdAt: { $gte: start, $lt: end }, settled: false },
        { settled: true, settledAt: now }
      ),
      RiderDebt.updateMany(
        { deliveryCompanyId: companyId, createdAt: { $gte: start, $lt: end }, settled: false },
        { settled: true, settledAt: now, note: note || "Monthly settlement" }
      ),
    ]);

    res.json({
      success: true,
      message: `✅ Rider earnings settled for ${monthLabel(month)}.`,
      data: {
        earningsSettled: earningsResult.modifiedCount,
        debtsSettled:    debtsResult.modifiedCount,
        transactionRef:  transactionRef || null,
        settledAt:       now,
      },
    });
  } catch (err) {
    console.error("payRiderEarnings error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
