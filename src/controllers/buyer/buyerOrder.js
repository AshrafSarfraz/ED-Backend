const BuyerOrder   = require("../../models/buyer/buyerOrder");
const PlatformItem = require("../../models/PlatformItem");
const Country      = require("../../models/Country");
const Invoice      = require("../../models/invoice");

// ═══════════════════════════════════════════════════════
//  BUYER — Place Order
//  POST /api/buyer/orders/place
// ═══════════════════════════════════════════════════════

exports.placeOrder = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can place orders" });
    }

    const { platformItemId, countryId, quantity, deliveryAddress } = req.body;
   
    const finalDeliveryAddress = deliveryAddress || {
      lat:     req.branch.address?.lat,
      lng:     req.branch.address?.lng,
      address: req.branch.address?.address,
      area:    req.branch.address?.area,
      city:    req.branch.address?.city,
    };
    

    if (!platformItemId || !countryId || !quantity) {
      return res.status(400).json({ success: false, message: "platformItemId, countryId, quantity required" });
    }

    const platformItem = await PlatformItem.findById(platformItemId);
    if (!platformItem) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    const country = await Country.findById(countryId);
    if (!country) {
      return res.status(404).json({ success: false, message: "Country not found" });
    }

    const now   = new Date();
    const hours = now.getUTCHours() + 3;
    if (hours >= 18) {
      return res.status(400).json({
        success: false,
        message: "Order window closed. Please order before 6:00 PM for tomorrow's bidding",
      });
    }

    const bidDate = new Date();
    bidDate.setHours(0, 0, 0, 0);

    const order = await BuyerOrder.create({
      buyerBranchId:  req.branch._id,
      buyerCompanyId: req.branch.companyId,
      platformItemId,
      countryId,
      quantity,
      deliveryAddress: finalDeliveryAddress,
      bidDate,
    });

    res.status(201).json({
      success: true,
      message: "Order placed! It will be included in today's bidding at 6:00 PM",
      data: order,
    });
  } catch (err) {
    console.error("placeOrder error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  BUYER — Get My Orders
//  GET /api/buyer/orders/my-orders
// ═══════════════════════════════════════════════════════
exports.getMyOrders = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can access this" });
    }

    const orders = await BuyerOrder.find({ buyerBranchId: req.branch._id })
      .populate("platformItemId", "name image unit")
      .populate("countryId", "name code")
      .sort({ createdAt: -1 });

    res.json({ success: true, total: orders.length, data: orders });
  } catch (err) {
    console.error("getMyOrders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  BUYER — Cancel Order
//  PUT /api/buyer/orders/:orderId/cancel
// ═══════════════════════════════════════════════════════
exports.cancelOrder = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can cancel orders" });
    }

    const order = await BuyerOrder.findOne({
      _id:           req.params.orderId,
      buyerBranchId: req.branch._id,
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const cancellableStatuses = ["pending", "in_bidding", "won"];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cancel nahi ho sakta — status: ${order.status}`,
      });
    }

    // Agar won hai toh dispatched check karo
    if (order.status === "won") {
      const invoice = await Invoice.findOne({ buyerOrderId: order._id });
      if (invoice && invoice.deliveryStatus === "dispatched") {
        return res.status(400).json({
          success: false,
          message: "Order already dispatched — cancel nahi ho sakta",
        });
      }

      if (invoice) {
        await Invoice.findByIdAndUpdate(invoice._id, {
          deliveryStatus: "cancelled",
          paymentStatus:  "unpaid",
        });
      }
    }

    await BuyerOrder.findByIdAndUpdate(order._id, { status: "cancelled" });

    res.json({ success: true, message: "Order cancelled successfully" });
  } catch (err) {
    console.error("cancelOrder error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  BUYER — Return Request
//  PUT /api/buyer/orders/:orderId/return
// ═══════════════════════════════════════════════════════
exports.returnOrder = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can request return" });
    }

    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, message: "Return reason required" });
    }

    const order = await BuyerOrder.findOne({
      _id:           req.params.orderId,
      buyerBranchId: req.branch._id,
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "Sirf delivered orders return ho sakte hain",
      });
    }

    // 24 hours check
    const invoice = await Invoice.findOne({ buyerOrderId: order._id });
    if (!invoice || !invoice.deliveredAt) {
      return res.status(400).json({ success: false, message: "Delivery info nahi mili" });
    }

    const now         = new Date();
    const deliveredAt = new Date(invoice.deliveredAt);
    const hoursPassed = (now - deliveredAt) / (1000 * 60 * 60);

    if (hoursPassed > 24) {
      return res.status(400).json({
        success: false,
        message: "Return window closed — sirf 24 hours andar return ho sakta hai",
      });
    }

    await BuyerOrder.findByIdAndUpdate(order._id, { status: "return_requested" });
    await Invoice.findByIdAndUpdate(invoice._id, {
      deliveryStatus: "returned",
      returnReason:   reason,
    });

    res.json({ success: true, message: "Return request submitted — supplier will review it" });
  } catch (err) {
    console.error("returnOrder error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};