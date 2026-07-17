// 📁 controllers/supplier/supplierDashboard.js
const Bid          = require("../../models/Bid");
const BulkOrder    = require("../../models/BulkOrder");
const BuyerOrder   = require("../../models/buyer/buyerOrder");
const Invoice      = require("../../models/invoice");
const SupplierItem = require("../../models/supplier/supplierCatalog");
const ReturnOrder  = require("../../models/returnOrder/ReturnOrder");
const LedgerEntry  = require("../../models/ledger/LedgerEntry");

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Dashboard Stats
//  GET /api/supplier/dashboard
// ═══════════════════════════════════════════════════════
exports.getSupplierDashboard = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }

    const branchId = req.branch._id;

    const [
      activeProducts,
      allBids,
      totalOrders,
      ordersToPack,
      returnRequests,
      earningRows,
    ] = await Promise.all([
      SupplierItem.countDocuments({ branchId, isListed: true, isAvailableToday: true }),
      Bid.countDocuments({ supplierBranchId: branchId }),
      BulkOrder.countDocuments({ winnerSupplierId: branchId }),
      BulkOrder.countDocuments({ winnerSupplierId: branchId, status: "awarded" }),
      ReturnOrder.countDocuments({ supplierBranchId: branchId, status: "pending" }),

      // Ledger — this supplier's full financial history (source of truth for money)
      LedgerEntry.aggregate([
        { $match: { entityType: "supplier", entityId: branchId } },
        {
          $group: {
            _id: "$direction",
            settled:   { $sum: { $cond: ["$settled", "$amount", 0] } },
            unsettled: { $sum: { $cond: [{ $eq: ["$settled", false] }, "$amount", 0] } },
          },
        },
      ]),
    ]);

    const credit = earningRows.find(r => r._id === "credit") || { settled: 0, unsettled: 0 };
    const debit  = earningRows.find(r => r._id === "debit")  || { settled: 0, unsettled: 0 };

    const totalEarning  = (credit.settled + credit.unsettled) - (debit.settled + debit.unsettled);
    const totalReleased = credit.settled - debit.settled;
    const totalPending   = credit.unsettled - debit.unsettled;

    res.json({
      success: true,
      data: {
        activeProducts,                                              // catalog items (listed + available)
        allBids,                                                     // total bids ever placed
        totalOrders,                                                 // total won bulk orders
        ordersToPack,                                                // awarded — packing pending
        returnRequests,                                              // pending return requests
        totalEarning:  Math.round(totalEarning  * 100) / 100,
        totalReleased: Math.round(totalReleased * 100) / 100,
        totalPending:  Math.round(totalPending  * 100) / 100,
      },
    });
  } catch (err) {
    console.error("getSupplierDashboard error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};