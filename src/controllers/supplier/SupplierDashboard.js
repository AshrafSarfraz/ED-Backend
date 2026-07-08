// 📁 controllers/supplier/supplierDashboard.js
const Bid          = require("../../models/Bid");
const BulkOrder    = require("../../models/BulkOrder");
const BuyerOrder   = require("../../models/buyer/buyerOrder");
const Invoice      = require("../../models/invoice");
const SupplierItem = require("../../models/supplier/supplierCatalog");
const ReturnOrder  = require("../../models/returnOrder/ReturnOrder");

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
      // 1. Active Products — listed + available today
      activeProducts,

      // 2. All Bids — total (won + lost + missed + ignored + pending)
      allBids,

      // 3. Total Orders — jitne bulk orders mein ye supplier winner raha
      totalOrders,

      // 4. Orders to Pack — awarded status (winner hai, abhi packed nahi)
      ordersToPack,

      // 5. Return Requests — pending (supplier ne abhi respond nahi kiya)
      returnRequests,

      // 6. Total Earning — supplier invoices grandTotal sum
      earningResult,

    ] = await Promise.all([

      // 1
      SupplierItem.countDocuments({
        branchId,
        isListed:         true,
        isAvailableToday: true,
      }),

      // 2
      Bid.countDocuments({ supplierBranchId: branchId }),

      // 3
      BulkOrder.countDocuments({ winnerSupplierId: branchId }),

      // 4 — awarded matlab supplier ne jeeta, abhi pack/ready karna baki hai
      BulkOrder.countDocuments({
        winnerSupplierId: branchId,
        status:           "awarded",
      }),

      // 5
      ReturnOrder.countDocuments({
        supplierBranchId: branchId,
        status:           "pending",
      }),

      // 6
      Invoice.aggregate([
        {
          $match: {
            supplierBranchId: branchId,
            invoiceType:      "supplier",
          },
        },
        {
          $group: {
            _id:           null,
            totalEarning:  { $sum: "$grandTotal" },
            totalReleased: { $sum: { $cond: [{ $eq: ["$supplierPaymentStatus", "released"] }, "$grandTotal", 0] } },
            totalPending:  { $sum: { $cond: [{ $ne: ["$supplierPaymentStatus", "released"] }, "$grandTotal", 0] } },
          },
        },
      ]),

    ]);

    const earning = earningResult[0] || { totalEarning: 0, totalReleased: 0, totalPending: 0 };

    res.json({
      success: true,
      data: {
        activeProducts,                                              // catalog items (listed + available)
        allBids,                                                     // total bids ever placed
        totalOrders,                                                 // total won bulk orders
        ordersToPack,                                                // awarded — packing pending
        returnRequests,                                              // pending return requests
        totalEarning:  Math.round(earning.totalEarning  * 100) / 100,
        totalReleased: Math.round(earning.totalReleased * 100) / 100,
        totalPending:  Math.round(earning.totalPending  * 100) / 100,
      },
    });
  } catch (err) {
    console.error("getSupplierDashboard error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};