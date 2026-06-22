// 📁 controllers/admin/adminOrders.js
const BuyerOrder  = require("../../models/buyer/buyerOrder");
const BulkOrder   = require("../../models/BulkOrder");
const Invoice     = require("../../models/invoice");

// ═══════════════════════════════════════════════════════
//  ADMIN — All Buyer Orders
//  GET /api/admin/orders?status=&search=&page=&limit=
// ═══════════════════════════════════════════════════════
exports.getAllOrders = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20, date } = req.query;

    const filter = {};
    if (status) filter.status = status;

    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end   = new Date(date); end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await BuyerOrder.countDocuments(filter);

    let orders = await BuyerOrder.find(filter)
      .populate("buyerBranchId",  "managerName companyName email phone")
      .populate("buyerCompanyId", "brandName")
      .populate("platformItemId", "name image unit")
      .populate("countryId",      "name code")
      .populate("bulkOrderId",    "winningPrice status winnerSupplierId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // search filter (buyer name / item name)
    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(o =>
        o.buyerBranchId?.managerName?.toLowerCase().includes(q) ||
        o.buyerBranchId?.companyName?.toLowerCase().includes(q) ||
        o.platformItemId?.name?.toLowerCase().includes(q)
      );
    }

    // Status summary counts
    const [
      totalAll, pending, in_bidding, won, packed,
      ready, delivered, cancelled, returned
    ] = await Promise.all([
      BuyerOrder.countDocuments({}),
      BuyerOrder.countDocuments({ status: "pending" }),
      BuyerOrder.countDocuments({ status: "in_bidding" }),
      BuyerOrder.countDocuments({ status: "won" }),
      BuyerOrder.countDocuments({ status: "packed" }),
      BuyerOrder.countDocuments({ status: "ready_for_pickup" }),
      BuyerOrder.countDocuments({ status: "delivered" }),
      BuyerOrder.countDocuments({ status: "cancelled" }),
      BuyerOrder.countDocuments({ status: "returned" }),
    ]);

    res.json({
      success: true,
      total,
      page:  Number(page),
      pages: Math.ceil(total / Number(limit)),
      summary: { totalAll, pending, in_bidding, won, packed, ready, delivered, cancelled, returned },
      data: orders.map(o => ({
        _id:          o._id,
        orderRef:     `#ORD-${o._id.toString().slice(-6).toUpperCase()}`,
        buyerName:    o.buyerBranchId?.managerName,
        companyName:  o.buyerBranchId?.companyName || o.buyerCompanyId?.brandName,
        buyerEmail:   o.buyerBranchId?.email,
        item:         o.platformItemId?.name,
        image:        o.platformItemId?.image,
        unit:         o.platformItemId?.unit,
        country:      o.countryId?.name,
        quantity:     o.quantity,
        status:       o.status,
        bidDate:      o.bidDate,
        minPrice:     o.minPrice,
        maxPrice:     o.maxPrice,
        estimatedAmount: o.estimatedAmount,
        winningPrice: o.bulkOrderId?.winningPrice || null,
        finalAmount:  o.bulkOrderId?.winningPrice
          ? Math.round(o.bulkOrderId.winningPrice * o.quantity * 1.03 * 100) / 100
          : null,
        bulkOrderId:  o.bulkOrderId?._id || null,
        bulkStatus:   o.bulkOrderId?.status || null,
        createdAt:    o.createdAt,
      })),
    });
  } catch (err) {
    console.error("getAllOrders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Cancel Order (force cancel — any status except delivered/returned)
//  PUT /api/admin/orders/:orderId/cancel
// ═══════════════════════════════════════════════════════
exports.adminCancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await BuyerOrder.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const nonCancellable = ["delivered", "returned", "cancelled"];
    if (nonCancellable.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel — order is already ${order.status}`,
      });
    }

    await BuyerOrder.findByIdAndUpdate(order._id, {
      status:          "cancelled",
      estimatedAmount: 0,
    });

    // If it was part of a bulk order — remove from buyerOrderIds
    if (order.bulkOrderId) {
      const bulk = await BulkOrder.findById(order.bulkOrderId);
      if (bulk && bulk.status === "bidding") {
        const remaining = bulk.buyerOrderIds.filter(
          id => id.toString() !== order._id.toString()
        );
        if (remaining.length === 0) {
          await BulkOrder.findByIdAndUpdate(bulk._id, { status: "cancelled" });
        } else {
          await BulkOrder.findByIdAndUpdate(bulk._id, {
            buyerOrderIds: remaining,
            $inc: { totalQuantity: -order.quantity },
          });
        }
      }
    }

    res.json({
      success: true,
      message: `Order #${req.params.orderId.slice(-6).toUpperCase()} cancelled by admin.`,
      reason: reason || null,
    });
  } catch (err) {
    console.error("adminCancelOrder error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
