
// 📁 controllers/admin/adminBuyerPayments.js
const Invoice    = require("../../models/invoice");
const Branch     = require("../../models/Branch");
const BuyerOrder = require("../../models/buyer/buyerOrder");

// ═══════════════════════════════════════════════════════
//  GET /api/admin/buyer-payments/summary
//  All buyers with their invoice summary
// ═══════════════════════════════════════════════════════
exports.getBuyerSummary = async (req, res) => {
  try {
    const summary = await Invoice.aggregate([
      { $match: { invoiceType: "buyer" } },
      {
        $group: {
          _id:           "$buyerBranchId",
          // Cancelled invoices (return resolved, supplier guilty) don't count as "billed" —
          // buyer never owed this money in the first place once the return was resolved
          totalBilled:   { $sum: { $cond: [{ $eq: ["$paymentStatus", "cancelled"] }, 0, "$grandTotal"] } },
          totalPaid:     { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$grandTotal", 0] } },
          totalDue:      { $sum: { $cond: [{ $in: ["$paymentStatus", ["paid", "cancelled"]] }, 0, "$amountDue"] } },
          totalRefundDue:{ $sum: "$refundAmount" },
          invoiceCount:  { $sum: { $cond: [{ $eq: ["$paymentStatus", "cancelled"] }, 0, 1] } },
          unpaidCount:   { $sum: { $cond: [{ $in: ["$paymentStatus", ["paid", "cancelled"]] }, 0, 1] } },
          overdueAmount: { $sum: { $cond: [{ $and: [{ $ne: ["$paymentStatus", "paid"] }, { $ne: ["$paymentStatus", "cancelled"] }, { $lt: ["$dueDate", new Date()] }] }, "$amountDue", 0] } },
          earliestDueDate: { $min: { $cond: [{ $in: ["$paymentStatus", ["paid", "cancelled"]] }, null, "$dueDate"] } },
        },
      },
      {
        $lookup: {
          from: "branches", localField: "_id", foreignField: "_id", as: "branch",
        },
      },
      { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          branchId:        "$_id",
          managerName:     "$branch.managerName",
          companyName:     "$branch.companyName",
          email:           "$branch.email",
          phone:           "$branch.phone",
          totalBilled:     { $round: ["$totalBilled",   2] },
          totalPaid:       { $round: ["$totalPaid",     2] },
          totalDue:        { $round: ["$totalDue",      2] },
          totalRefundDue:  { $round: ["$totalRefundDue", 2] },
          overdueAmount:   { $round: ["$overdueAmount", 2] },
          invoiceCount:    1,
          unpaidCount:     1,
          earliestDueDate: 1,
        },
      },
      { $sort: { totalDue: -1 } },
    ]);

    res.json({ success: true, total: summary.length, data: summary });
  } catch (err) {
    console.error("getBuyerSummary error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  GET /api/admin/buyer-payments/delivery-tracking
//  Reporting-only screen: buyer-wise delivered order count +
//  the 1% delivery fee already charged per order (monthly summary).
//  No new charge — purely visibility into what's already in each invoice's deliveryAmount.
// ═══════════════════════════════════════════════════════
exports.getBuyerDeliveryTracking = async (req, res) => {
  try {
    const summary = await Invoice.aggregate([
      { $match: { invoiceType: "buyer", deliveryStatus: "delivered" } },
      {
        $group: {
          _id: {
            buyerBranchId: "$buyerBranchId",
            month:         { $dateToString: { format: "%Y-%m", date: "$deliveredAt" } },
          },
          deliveredCount:   { $sum: 1 },
          totalDeliveryFee: { $sum: "$deliveryAmount" }, // 1% already charged, per order
          totalOrderValue:  { $sum: "$grandTotal" },
        },
      },
      {
        $group: {
          _id: "$_id.buyerBranchId",
          months: {
            $push: {
              month:            "$_id.month",
              deliveredCount:   "$deliveredCount",
              totalDeliveryFee: { $round: ["$totalDeliveryFee", 2] },
              totalOrderValue:  { $round: ["$totalOrderValue",  2] },
            },
          },
          totalDeliveredCount: { $sum: "$deliveredCount" },
          totalDeliveryFee:    { $sum: "$totalDeliveryFee" },
        },
      },
      {
        $lookup: { from: "branches", localField: "_id", foreignField: "_id", as: "branch" },
      },
      { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          branchId:            "$_id",
          managerName:         "$branch.managerName",
          companyName:         "$branch.companyName",
          email:               "$branch.email",
          totalDeliveredCount: 1,
          totalDeliveryFee:    { $round: ["$totalDeliveryFee", 2] },
          months:              { $sortArray: { input: "$months", sortBy: { month: -1 } } },
        },
      },
      { $sort: { totalDeliveredCount: -1 } },
    ]);

    res.json({ success: true, total: summary.length, data: summary });
  } catch (err) {
    console.error("getBuyerDeliveryTracking error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  GET /api/admin/buyer-payments/:branchId
//  Single buyer — all invoices with item details
// ═══════════════════════════════════════════════════════
exports.getBuyerInvoices = async (req, res) => {
  try {
    const { branchId } = req.params;

    // Buyer branch info
    const branch = await Branch.findById(branchId).select("managerName companyName email phone");
    if (!branch) return res.status(404).json({ success: false, message: "Buyer not found" });

    // All buyer invoices
    const invoices = await Invoice.find({
      buyerBranchId: branchId,
      invoiceType:   "buyer",
    })
      .populate("platformItemId", "name image unit")
      .populate("countryId",      "name")
      .populate("bulkOrderId",    "_id winningPrice")
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();

    const data = invoices.map(inv => ({
      _id:           inv._id,
      invoiceNumber: inv.invoiceNumber,
      item:          inv.platformItemId?.name,
      image:         inv.platformItemId?.image,
      unit:          inv.platformItemId?.unit,
      country:       inv.countryId?.name,
      quantity:      inv.quantity,
      pricePerUnit:  inv.pricePerUnit,
      grandTotal:    inv.grandTotal,
      amountDue:     inv.amountDue,
      amountPaid:    inv.amountPaid,
      refundAmount:  inv.refundAmount || 0,
      paymentStatus: inv.paymentStatus,
      isCancelled:   inv.paymentStatus === "cancelled",
      dueDate:       inv.dueDate,
      isOverdue:     !["paid", "cancelled"].includes(inv.paymentStatus) && inv.dueDate && new Date(inv.dueDate) < now,
      bulkOrderId:   inv.bulkOrderId?._id || null,
      createdAt:     inv.createdAt,
      bidDate:       inv.bidDate || inv.createdAt,
    }));

    // Totals — cancelled (returned) invoices excluded from "billed", buyer no longer owes them
    const activeInvoices = data.filter(i => i.paymentStatus !== "cancelled");
    const totalBilled    = activeInvoices.reduce((s, i) => s + (i.grandTotal || 0), 0);
    const totalPaid      = data.reduce((s, i) => s + (i.amountPaid  || 0), 0);
    const totalDue       = activeInvoices.filter(i => i.paymentStatus !== "paid").reduce((s, i) => s + (i.amountDue || 0), 0);
    const overdueAmount  = activeInvoices.filter(i => i.isOverdue).reduce((s, i) => s + (i.amountDue || 0), 0);
    const totalRefundDue = data.reduce((s, i) => s + (i.refundAmount || 0), 0);

    res.json({
      success: true,
      buyer: {
        branchId,
        managerName:    branch.managerName,
        companyName:    branch.companyName,
        email:          branch.email,
        phone:          branch.phone,
        totalBilled:    Math.round(totalBilled    * 100) / 100,
        totalPaid:      Math.round(totalPaid      * 100) / 100,
        totalDue:       Math.round(totalDue       * 100) / 100,
        overdueAmount:  Math.round(overdueAmount  * 100) / 100,
        totalRefundDue: Math.round(totalRefundDue * 100) / 100,
      },
      invoices: data,
    });
  } catch (err) {
    console.error("getBuyerInvoices error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};