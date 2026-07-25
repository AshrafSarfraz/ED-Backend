
// kitni purchase ki, kitna paid/due hai. Ek jagah, admin ke liye.
const Branch      = require("../../models/Branch");
const BuyerOrder  = require("../../models/buyer/buyerOrder");
const Invoice     = require("../../models/invoice");
const ReturnOrder = require("../../models/returnOrder/ReturnOrder");

// ═══════════════════════════════════════════════════════
//  GET /api/admin/buyer-profile/:branchId
// ═══════════════════════════════════════════════════════
exports.getBuyerProfile = async (req, res) => {
  try {
    const { branchId } = req.params;

    const branch = await Branch.findById(branchId)
      .select("-password")
      .populate("companyId", "brandName email tradeLicenseNumber");
    if (!branch) return res.status(404).json({ success: false, message: "Buyer not found" });

    const [orderStatusCounts, invoiceAgg, returnStatusCounts, recentOrders, recentReturns] = await Promise.all([
      // Order counts by status — "kitna order kiya, kitna deliver/return/cancel hua"
      BuyerOrder.aggregate([
        { $match: { buyerBranchId: branch._id } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Purchase value + payment progress — "kitni purchase ki, kitna paid/due hai"
      Invoice.aggregate([
        { $match: { buyerBranchId: branch._id, invoiceType: "buyer" } },
        {
          $group: {
            _id: null,
            totalPurchaseValue: { $sum: "$grandTotal" },
            totalPaid:          { $sum: "$amountPaid" },
            totalDue:           { $sum: { $cond: [{ $ne: ["$paymentStatus", "paid"] }, "$amountDue", 0] } },
            invoiceCount:       { $sum: 1 },
            paidCount:          { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
          },
        },
      ]),

      // Return breakdown — "kitna return howa, kitna approve/resolve hua"
      ReturnOrder.aggregate([
        { $match: { buyerBranchId: branch._id } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      BuyerOrder.find({ buyerBranchId: branch._id })
        .populate("platformItemId", "name image unit")
        .populate("countryId", "name")
        .sort({ createdAt: -1 }).limit(15).lean(),

      ReturnOrder.find({ buyerBranchId: branch._id })
        .populate("invoiceId", "invoiceNumber grandTotal")
        .sort({ createdAt: -1 }).limit(15).lean(),
    ]);

    const statusMap = {};
    orderStatusCounts.forEach(s => { statusMap[s._id] = s.count; });

    const returnMap = {};
    returnStatusCounts.forEach(s => { returnMap[s._id] = s.count; });

    const invoiceStats = invoiceAgg[0] || { totalPurchaseValue: 0, totalPaid: 0, totalDue: 0, invoiceCount: 0, paidCount: 0 };
    const totalOrders  = orderStatusCounts.reduce((s, r) => s + r.count, 0);
    const totalReturnsRequested = returnStatusCounts.reduce((s, r) => s + r.count, 0);

    res.json({
      success: true,
      buyer: {
        branchId:    branch._id,
        managerName: branch.managerName,
        companyName: branch.companyName,
        email:       branch.email,
        phone:       branch.phone,
        status:      branch.status,
        isActive:    branch.isActive,
        joinedAt:    branch.createdAt,
        company:     branch.companyId,
      },
      orderSummary: {
        totalOrders,
        delivered:        statusMap.delivered || 0,
        pending:          statusMap.pending || 0,
        inBidding:        statusMap.in_bidding || 0,
        won:              statusMap.won || 0,
        packed:           statusMap.packed || 0,
        readyForPickup:   statusMap.ready_for_pickup || 0,
        cancelled:        statusMap.cancelled || 0,
        returnRequested:  statusMap.return_requested || 0,
        returned:         statusMap.returned || 0,
      },
      purchaseSummary: {
        totalPurchaseValue: Math.round(invoiceStats.totalPurchaseValue * 100) / 100,
        totalPaid:          Math.round(invoiceStats.totalPaid          * 100) / 100,
        totalDue:           Math.round(invoiceStats.totalDue           * 100) / 100,
        invoiceCount:       invoiceStats.invoiceCount,
        paidCount:          invoiceStats.paidCount,
        unpaidCount:        invoiceStats.invoiceCount - invoiceStats.paidCount,
      },
      returnSummary: {
        totalReturnsRequested,
        pending:                returnMap.pending || 0,
        supplierAccepted:       returnMap.supplier_accepted || 0,
        supplierRejected:       returnMap.supplier_rejected || 0,
        resolvedCancelled:      returnMap.resolved_cancelled || 0,
        resolvedSupplierGuilty: returnMap.resolved_supplier_guilty || 0,
        resolvedRiderGuilty:    returnMap.resolved_rider_guilty || 0,
      },
      recentOrders,
      recentReturns,
    });
  } catch (err) {
    console.error("getBuyerProfile error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
