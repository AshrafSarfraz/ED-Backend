// 📁 controllers/admin/adminSupplierPayment.js
// ═══════════════════════════════════════════════════════
//  Ledger-driven — sab money figures (earned/pending/released) LedgerEntry se
//  live compute hote hain, kisi Invoice field mein manually +/- nahi hota.
//  Invoice sirf item/quantity/buyer jaisi DISPLAY detail ke liye query hoti hai.
// ═══════════════════════════════════════════════════════
const Invoice      = require("../../models/invoice");
const BulkOrder     = require("../../models/BulkOrder");
const Branch        = require("../../models/Branch");
const LedgerEntry    = require("../../models/ledger/LedgerEntry");
const { getCommissionSettings } = require("../../cron/commissionSettingService");
const ledger = require("../../services/ledgerService");

const DAY_MS = 24 * 60 * 60 * 1000;

const getPaymentDays_helper = async () => {
  const s = await getCommissionSettings();
  return s.supplierPaymentDays || 60;
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Payment days overview (grouped by day the entry was recorded)
//  GET /api/admin/supplier-payments/days
// ═══════════════════════════════════════════════════════
exports.getPaymentDays = async (req, res) => {
  try {
    const PAYMENT_DAYS = await getPaymentDays_helper();

    const entries = await LedgerEntry.find({ entityType: "supplier" }).lean();

    const dayMap = {};
    entries.forEach(e => {
      const dateKey = new Date(e.createdAt).toISOString().slice(0, 10);
      if (!dayMap[dateKey]) {
        dayMap[dateKey] = {
          date: dateKey,
          dateLabel: new Date(dateKey).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          deadline: new Date(new Date(dateKey).getTime() + PAYMENT_DAYS * DAY_MS).toISOString().slice(0, 10),
          daysLeft: Math.ceil((new Date(dateKey).getTime() + PAYMENT_DAYS * DAY_MS - Date.now()) / DAY_MS),
          totalAmount: 0, totalPending: 0, totalReleased: 0, totalDeducted: 0,
          bulkOrderIds: new Set(),
        };
      }
      const d = dayMap[dateKey];
      if (e.bulkOrderId) d.bulkOrderIds.add(e.bulkOrderId.toString());

      const signed = e.direction === "credit" ? e.amount : -e.amount;
      if (e.category === "return_penalty") d.totalDeducted += e.amount;
      else d.totalAmount += signed; // order_earning credits (this day's gross earning)

      if (e.settled) d.totalReleased += signed;
      else           d.totalPending  += signed;
    });

    const result = Object.values(dayMap)
      .map(d => ({
        ...d,
        totalBulkOrders: d.bulkOrderIds.size,
        totalAmount:    Math.round(d.totalAmount    * 100) / 100,
        totalPending:   Math.round(d.totalPending   * 100) / 100,
        totalReleased:  Math.round(d.totalReleased  * 100) / 100,
        totalDeducted:  Math.round(d.totalDeducted  * 100) / 100,
        isOverdue:      d.daysLeft < 0,
        isUrgent:       d.daysLeft >= 0 && d.daysLeft <= 7,
        fullyPaid:      Math.round(d.totalPending * 100) / 100 === 0,
        bulkOrderIds:   undefined,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const overall = {
      totalPending:  Math.round(result.reduce((s, r) => s + r.totalPending,  0) * 100) / 100,
      totalReleased: Math.round(result.reduce((s, r) => s + r.totalReleased, 0) * 100) / 100,
      totalAmount:   Math.round(result.reduce((s, r) => s + r.totalAmount,   0) * 100) / 100,
      totalDeducted: Math.round(result.reduce((s, r) => s + r.totalDeducted, 0) * 100) / 100,
      overdueDays:   result.filter(r => r.isOverdue && !r.fullyPaid).length,
      urgentDays:    result.filter(r => r.isUrgent  && !r.fullyPaid).length,
    };

    res.json({ success: true, overall, total: result.length, data: result });
  } catch (err) {
    console.error("getPaymentDays error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Bulk orders for a specific date (with invoice-level display detail)
//  GET /api/admin/supplier-payments/days/:date/bulk-orders
// ═══════════════════════════════════════════════════════
exports.getDayBulkOrders = async (req, res) => {
  try {
    const { date } = req.params;
    const PAYMENT_DAYS = await getPaymentDays_helper();
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);

    const entries = await LedgerEntry.find({
      entityType: "supplier",
      createdAt: { $gte: start, $lte: end },
    }).lean();

    if (entries.length === 0) {
      return res.json({ success: true, date, dayTotal: { totalAmount: 0, totalPending: 0, totalReleased: 0, bulkOrderCount: 0, deadline: null, daysLeft: null }, total: 0, data: [] });
    }

    const invoiceIds = [...new Set(entries.filter(e => e.invoiceId).map(e => e.invoiceId.toString()))];
    const invoices = await Invoice.find({ _id: { $in: invoiceIds } })
      .populate("supplierBranchId", "managerName companyName phone email bankDetails")
      .populate("bulkOrderId",      "totalQuantity winningPrice status readyAt")
      .populate("platformItemId",   "name unit image")
      .populate("countryId",        "name")
      .populate("buyerBranchId",    "managerName companyName")
      .lean();
    const invoiceMap = {};
    invoices.forEach(inv => { invoiceMap[inv._id.toString()] = inv; });

    // Group ledger entries by invoiceId → compute net per invoice
    const perInvoice = {};
    entries.forEach(e => {
      if (!e.invoiceId) return;
      const id = e.invoiceId.toString();
      if (!perInvoice[id]) perInvoice[id] = { credit: 0, debit: 0, allSettled: true, hasPenalty: false };
      if (e.direction === "credit") perInvoice[id].credit += e.amount;
      else perInvoice[id].debit += e.amount;
      if (!e.settled) perInvoice[id].allSettled = false;
      if (e.category === "return_penalty") perInvoice[id].hasPenalty = true;
    });

    const bulkMap = {};
    Object.entries(perInvoice).forEach(([invId, agg]) => {
      const inv = invoiceMap[invId];
      if (!inv) return;
      const bulkId = inv.bulkOrderId?._id?.toString() || "unknown";

      if (!bulkMap[bulkId]) {
        bulkMap[bulkId] = {
          bulkOrderId: bulkId,
          orderRef: `#ORD-${bulkId.slice(-6).toUpperCase()}`,
          item: inv.platformItemId?.name, image: inv.platformItemId?.image, unit: inv.platformItemId?.unit,
          country: inv.countryId?.name,
          totalQuantity: inv.bulkOrderId?.totalQuantity, winningPrice: inv.bulkOrderId?.winningPrice,
          bulkStatus: inv.bulkOrderId?.status, readyAt: inv.bulkOrderId?.readyAt,
          supplierName: inv.supplierBranchId?.managerName, supplierCompany: inv.supplierBranchId?.companyName,
          supplierPhone: inv.supplierBranchId?.phone, supplierEmail: inv.supplierBranchId?.email,
          supplierBank: inv.supplierBranchId?.bankDetails || null, supplierBranchId: inv.supplierBranchId?._id,
          buyerOrders: [], totalAmount: 0, totalPending: 0, totalReleased: 0, totalDeduction: 0,
        };
      }

      const b = bulkMap[bulkId];
      const netAmount = Math.round((agg.credit - agg.debit) * 100) / 100;
      const grossAmount = Math.round((inv.grandTotal || 0) * 100) / 100;

      b.buyerOrders.push({
        invoiceId: inv._id, invoiceNumber: inv.invoiceNumber,
        buyerName: inv.buyerBranchId?.managerName, buyerCompany: inv.buyerBranchId?.companyName,
        quantity: inv.quantity, pricePerUnit: inv.pricePerUnit,
        amount: agg.hasPenalty ? 0 : grossAmount,
        deduction: Math.round(agg.debit * 100) / 100,
        netAmount, isReturned: agg.hasPenalty,
        orderStatus: inv.buyerOrderId ? "—" : null,
        status: agg.allSettled ? "released" : "pending",
        paidAt: inv.supplierPaidAt || null,
      });

      b.totalAmount   += netAmount;
      b.totalDeduction += agg.debit;
      if (agg.allSettled) b.totalReleased += netAmount;
      else                b.totalPending  += netAmount;
    });

    const result = Object.values(bulkMap).map(b => ({
      ...b,
      totalAmount:      Math.round(b.totalAmount     * 100) / 100,
      totalPending:     Math.round(b.totalPending    * 100) / 100,
      totalReleased:    Math.round(b.totalReleased   * 100) / 100,
      totalDeduction:   Math.round(b.totalDeduction  * 100) / 100,
      netToPaySupplier: Math.round(b.totalPending    * 100) / 100,
      fullyPaid:        Math.round(b.totalPending    * 100) / 100 === 0,
      buyerCount:       b.buyerOrders.length,
    }));

    const dayTotal = {
      totalAmount:    Math.round(result.reduce((s, r) => s + r.totalAmount,   0) * 100) / 100,
      totalPending:   Math.round(result.reduce((s, r) => s + r.totalPending,  0) * 100) / 100,
      totalReleased:  Math.round(result.reduce((s, r) => s + r.totalReleased, 0) * 100) / 100,
      bulkOrderCount: result.length,
      deadline: new Date(new Date(date).getTime() + PAYMENT_DAYS * DAY_MS).toISOString().slice(0, 10),
      daysLeft: Math.ceil((new Date(date).getTime() + PAYMENT_DAYS * DAY_MS - Date.now()) / DAY_MS),
    };

    res.json({ success: true, date, dayTotal, total: result.length, data: result });
  } catch (err) {
    console.error("getDayBulkOrders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Pay Supplier(s) — single bulk order OR all suppliers for a day
//  POST /api/admin/supplier-payments/pay
//  Body: { bulkOrderId } OR { date }, note, transactionRef
// ═══════════════════════════════════════════════════════
exports.paySupplier = async (req, res) => {
  try {
    const { bulkOrderId, date, note, transactionRef } = req.body;
    if (!bulkOrderId && !date) {
      return res.status(400).json({ success: false, message: "bulkOrderId or date required" });
    }

    let entityIds = [];
    let commonOpts = { note, transactionRef, paidBy: req.admin._id };
    const payouts = [];

    if (bulkOrderId) {
      entityIds = await ledger.getUnsettledEntityIds("supplier", {});
      // narrow to suppliers who actually have unsettled entries for this bulk order
      const relevant = await LedgerEntry.distinct("entityId", { entityType: "supplier", settled: false, bulkOrderId });
      entityIds = relevant.map(id => id.toString());
      for (const entityId of entityIds) {
        const result = await ledger.settleAndPayout({ entityType: "supplier", entityId, extraFilter: { bulkOrderId }, ...commonOpts });
        if (result) payouts.push(result);
      }
    } else {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end   = new Date(date); end.setHours(23, 59, 59, 999);
      const relevant = await ledger.getUnsettledEntityIds("supplier", { start, end });
      for (const entityId of relevant) {
        const result = await ledger.settleAndPayout({ entityType: "supplier", entityId, start, end, ...commonOpts });
        if (result) payouts.push(result);
      }
    }

    if (payouts.length === 0) {
      return res.status(400).json({ success: false, message: "No pending supplier payments found" });
    }

    const totalPaid = Math.round(payouts.reduce((s, p) => s + p.netAmount, 0) * 100) / 100;
    const invoiceCount = payouts.reduce((s, p) => s + p.entryCount, 0);

    res.json({
      success: true,
      message: `✅ Payment released to ${payouts.length} supplier(s).`,
      data: { invoiceCount, totalPaid, paidAt: new Date(), note: note || null, transactionRef: transactionRef || null },
    });
  } catch (err) {
    console.error("paySupplier error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Supplier Payment Records (lifetime, per supplier)
//  GET /api/admin/supplier-payments/suppliers
// ═══════════════════════════════════════════════════════
exports.getSupplierPaymentRecords = async (req, res) => {
  try {
    const summary = await LedgerEntry.aggregate([
      { $match: { entityType: "supplier" } },
      {
        $group: {
          _id: "$entityId",
          totalEarned:   { $sum: { $cond: [{ $eq: ["$category", "order_earning"] }, "$amount", 0] } },
          totalDeducted: { $sum: { $cond: [{ $eq: ["$category", "return_penalty"] }, "$amount", 0] } },
          totalReleased: { $sum: { $cond: ["$settled", { $cond: [{ $eq: ["$direction", "credit"] }, "$amount", { $multiply: ["$amount", -1] }] }, 0] } },
          totalPending:  { $sum: { $cond: [{ $eq: ["$settled", false] }, { $cond: [{ $eq: ["$direction", "credit"] }, "$amount", { $multiply: ["$amount", -1] }] }, 0] } },
          invoiceCount:  { $sum: { $cond: [{ $eq: ["$category", "order_earning"] }, 1, 0] } },
          pendingCount:  { $sum: { $cond: [{ $and: [{ $eq: ["$category", "order_earning"] }, { $eq: ["$settled", false] }] }, 1, 0] } },
          lastActivity:  { $max: "$createdAt" },
        },
      },
      { $lookup: { from: "branches", localField: "_id", foreignField: "_id", as: "branch" } },
      { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          branchId: "$_id", supplierName: "$branch.managerName", companyName: "$branch.companyName",
          email: "$branch.email", phone: "$branch.phone", bankDetails: "$branch.bankDetails",
          totalEarned:   { $round: ["$totalEarned",   2] },
          totalReleased: { $round: ["$totalReleased", 2] },
          totalPending:  { $round: ["$totalPending",  2] },
          totalDeducted: { $round: ["$totalDeducted", 2] },
          invoiceCount: 1, pendingCount: 1, lastActivity: 1,
        },
      },
      { $sort: { totalPending: -1 } },
    ]);

    res.json({ success: true, total: summary.length, data: summary });
  } catch (err) {
    console.error("getSupplierPaymentRecords error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
