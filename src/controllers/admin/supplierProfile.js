// 📁 controllers/admin/supplierProfile.js
// Supplier ka poora record — kitna order jeeta, kitna deliver/return hua,
// bidding performance, aur ledger se poora financial history.
const Branch      = require("../../models/Branch");
const Bid         = require("../../models/Bid");
const BulkOrder   = require("../../models/BulkOrder");
const ReturnOrder = require("../../models/returnOrder/ReturnOrder");
const LedgerEntry = require("../../models/ledger/LedgerEntry");

// ═══════════════════════════════════════════════════════
//  GET /api/admin/supplier-profile/:branchId
// ═══════════════════════════════════════════════════════
exports.getSupplierProfile = async (req, res) => {
  try {
    const { branchId } = req.params;

    const branch = await Branch.findById(branchId)
      .select("-password")
      .populate("companyId", "brandName email tradeLicenseNumber");
    if (!branch) return res.status(404).json({ success: false, message: "Supplier not found" });

    const [bidStatusCounts, bulkStatusCounts, returnStatusCounts, ledgerRows, recentBids, recentReturns] = await Promise.all([
      // Bidding performance — "kitna bid kiya, kitna jeeta"
      Bid.aggregate([
        { $match: { supplierBranchId: branch._id } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Won-order fulfillment status — "kitna deliver hua"
      BulkOrder.aggregate([
        { $match: { winnerSupplierId: branch._id } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Returns where this supplier was involved
      ReturnOrder.aggregate([
        { $match: { supplierBranchId: branch._id } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Ledger — full financial history (source of truth for money)
      LedgerEntry.aggregate([
        { $match: { entityType: "supplier", entityId: branch._id } },
        {
          $group: {
            _id: { category: "$category", settled: "$settled" },
            total: { $sum: "$amount" },
          },
        },
      ]),

      Bid.find({ supplierBranchId: branch._id })
        .populate("bulkOrderId", "totalQuantity winningPrice status")
        .sort({ createdAt: -1 }).limit(15).lean(),

      ReturnOrder.find({ supplierBranchId: branch._id })
        .populate("invoiceId", "invoiceNumber grandTotal")
        .sort({ createdAt: -1 }).limit(15).lean(),
    ]);

    const bidMap = {};
    bidStatusCounts.forEach(s => { bidMap[s._id] = s.count; });

    const bulkMap = {};
    bulkStatusCounts.forEach(s => { bulkMap[s._id] = s.count; });

    const returnMap = {};
    returnStatusCounts.forEach(s => { returnMap[s._id] = s.count; });

    // Ledger rows → totalEarned / totalPenalty / totalPending / totalReleased
    let totalOrderEarning = 0, totalPenalty = 0, totalPendingNet = 0, totalReleasedNet = 0;
    ledgerRows.forEach(r => {
      const isCredit = r._id.category !== "return_penalty";
      const signed = isCredit ? r.total : -r.total;
      if (r._id.category === "order_earning") totalOrderEarning += r.total;
      if (r._id.category === "return_penalty") totalPenalty += r.total;
      if (r._id.settled) totalReleasedNet += signed;
      else                totalPendingNet += signed;
    });

    const totalWonOrders = bulkStatusCounts.reduce((s, r) => s + r.count, 0);

    res.json({
      success: true,
      supplier: {
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
      biddingSummary: {
        totalBids: bidStatusCounts.reduce((s, r) => s + r.count, 0),
        won:      bidMap.won      || 0,
        lost:     bidMap.lost     || 0,
        missed:   bidMap.missed   || 0,      // eligible tha, join nahi kiya
        active:   bidMap.active   || 0,      // abhi chal rahi bidding
        // purane records ke liye — naye system me ye statuses nahi bante
        ignored:  bidMap.ignored  || 0,
        pending:  bidMap.pending  || 0,
      },
      orderSummary: {
        totalWonOrders,
        bidding:  bulkMap.bidding  || 0,
        awarded:  bulkMap.awarded  || 0,
        ready:    bulkMap.ready    || 0, // = delivered/fulfilled
        cancelled:bulkMap.cancelled|| 0,
      },
      returnSummary: {
        totalReturnsInvolved: returnStatusCounts.reduce((s, r) => s + r.count, 0),
        pending:            returnMap.pending || 0,
        supplierAccepted:   returnMap.supplier_accepted || 0,
        supplierRejected:   returnMap.supplier_rejected || 0,
        resolvedCancelled:  returnMap.resolved_cancelled || 0,
        resolvedGuilty:     returnMap.resolved_supplier_guilty || 0, // supplier was at fault
        resolvedNotGuilty:  returnMap.resolved_rider_guilty || 0,    // rider was at fault instead
      },
      financialSummary: {
        totalOrderEarning: Math.round(totalOrderEarning * 100) / 100, // gross, before any penalty
        totalPenalty:      Math.round(totalPenalty       * 100) / 100, // return_guilty deductions
        totalNetEarned:    Math.round((totalOrderEarning - totalPenalty) * 100) / 100,
        totalPending:      Math.round(totalPendingNet     * 100) / 100, // still owed to supplier
        totalReleased:     Math.round(totalReleasedNet    * 100) / 100, // already paid out
      },
      recentBids,
      recentReturns,
    });
  } catch (err) {
    console.error("getSupplierProfile error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
