// 📁 controllers/admin/riderEarnings.js
// ═══════════════════════════════════════════════════════
//  Ledger-driven — rider ki monthly earnings/debt/net-payable sab LedgerEntry se
//  live compute hoti hain (entityType: "rider").
// ═══════════════════════════════════════════════════════
const LedgerEntry    = require("../../models/ledger/LedgerEntry");
const DeliveryCompany = require("../../models/riderCompany/riderCompany");
const ledger = require("../../services/ledgerService");

const monthKey   = (d) => new Date(d).toISOString().slice(0, 7); // "2026-07"
const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Rider earnings grouped by month, per rider company
//  GET /api/admin/rider-earnings/months
// ═══════════════════════════════════════════════════════
exports.getEarningMonths = async (req, res) => {
  try {
    const entries = await LedgerEntry.find({ entityType: "rider" }).lean();
    const companyIds = [...new Set(entries.map(e => e.entityId.toString()))];
    const companies = await DeliveryCompany.find({ _id: { $in: companyIds } }).select("name email phone").lean();
    const companyMap = {};
    companies.forEach(c => { companyMap[c._id.toString()] = c; });

    const map = {}; // key: `${monthKey}_${companyId}`
    entries.forEach(e => {
      const cid = e.entityId.toString();
      const mk  = monthKey(e.createdAt);
      const key = `${mk}_${cid}`;
      if (!map[key]) {
        map[key] = {
          month: mk, monthLabel: monthLabel(mk),
          companyId: cid, company: companyMap[cid] || null,
          deliveryEarning: 0, returnLegEarning: 0, debtAmount: 0,
          totalEarning: 0, netPayable: 0, settled: true,
        };
      }
      const row = map[key];
      if (e.category === "delivery_fee")      row.deliveryEarning  += e.amount;
      if (e.category === "return_leg_fee")    row.returnLegEarning += e.amount;
      if (e.category === "rider_guilty_debt") row.debtAmount       += e.amount;

      if (e.direction === "credit") row.totalEarning += e.amount;
      row.netPayable += e.direction === "credit" ? e.amount : -e.amount;
      if (!e.settled) row.settled = false;
    });

    const result = Object.values(map)
      .map(r => ({
        ...r,
        deliveryEarning:  Math.round(r.deliveryEarning  * 100) / 100,
        returnLegEarning: Math.round(r.returnLegEarning * 100) / 100,
        totalEarning:     Math.round(r.totalEarning     * 100) / 100,
        debtAmount:       Math.round(r.debtAmount        * 100) / 100,
        netPayable:       Math.round(r.netPayable         * 100) / 100,
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
// ═══════════════════════════════════════════════════════
exports.getEarningDetail = async (req, res) => {
  try {
    const { month, companyId } = req.params;
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end   = new Date(start); end.setMonth(end.getMonth() + 1);

    const [entries, company] = await Promise.all([
      LedgerEntry.find({ entityType: "rider", entityId: companyId, createdAt: { $gte: start, $lt: end } })
        .populate("invoiceId", "invoiceNumber grandTotal")
        .sort({ createdAt: -1 }).lean(),
      DeliveryCompany.findById(companyId).select("name email phone"),
    ]);

    const totalEarning = entries.filter(e => e.direction === "credit").reduce((s, e) => s + e.amount, 0);
    const totalDebt     = entries.filter(e => e.direction === "debit").reduce((s, e) => s + e.amount, 0);

    res.json({
      success: true,
      month, monthLabel: monthLabel(month),
      company,
      summary: {
        totalEarning: Math.round(totalEarning * 100) / 100,
        totalDebt:    Math.round(totalDebt     * 100) / 100,
        netPayable:   Math.round((totalEarning - totalDebt) * 100) / 100,
      },
      earnings: entries.filter(e => e.direction === "credit").map(e => ({
        _id: e._id, createdAt: e.createdAt, settled: e.settled,
        reason: e.category === "delivery_fee" ? "delivery" : "return_leg",
        invoiceNumber: e.invoiceId?.invoiceNumber, invoiceId: e.invoiceId,
        earningAmount: e.amount,
      })),
      debts: entries.filter(e => e.direction === "debit").map(e => ({
        _id: e._id, createdAt: e.createdAt, settled: e.settled,
        invoiceNumber: e.invoiceId?.invoiceNumber,
        grandTotal: e.invoiceId?.grandTotal, netOwed: e.amount,
      })),
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

    const result = await ledger.settleAndPayout({
      entityType: "rider", entityId: companyId, start, end,
      transactionRef, note, paidBy: req.admin._id,
    });

    if (!result) {
      return res.status(400).json({ success: false, message: "No unsettled entries found for this month" });
    }

    res.json({
      success: true,
      message: `✅ Rider earnings settled for ${monthLabel(month)}.`,
      data: {
        entriesSettled: result.entryCount,
        netAmount:      result.netAmount,
        transactionRef: transactionRef || null,
        settledAt:      result.payout.paidAt,
      },
    });
  } catch (err) {
    console.error("payRiderEarnings error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
