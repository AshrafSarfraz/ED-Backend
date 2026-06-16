// 📁 controllers/delivery/delivery.js
// Delivery company ke endpoints — orders uthana + status update
const DeliveryOrder   = require("../../models/riderCompany/orderDelivery");
const BuyerOrder      = require("../../models/buyer/buyerOrder");
const BulkOrder       = require("../../models/BulkOrder");
const Invoice         = require("../../models/invoice");
const { getDeliverySettings } = require("../../cron/deliverySetting");

// ═══════════════════════════════════════════════════════
//  1) Available Orders — jo ready hain pick ke liye
//  GET /api/delivery/orders/available
// ═══════════════════════════════════════════════════════
exports.getAvailableOrders = async (req, res) => {
  try {
    const orders = await DeliveryOrder.find({ status: "pending" })
      .sort({ readyAt: 1 }); // jo pehle ready hua, pehle dikhe

    res.json({ success: true, total: orders.length, data: orders });
  } catch (err) {
    console.error("getAvailableOrders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  2) My Active Orders — jo is company ne pick kiye (chal rahe)
//  GET /api/delivery/orders/active
// ═══════════════════════════════════════════════════════
exports.getMyActiveOrders = async (req, res) => {
  try {
    const orders = await DeliveryOrder.find({
      deliveryCompanyId: req.deliveryCompany._id,
      status:            { $in: ["picked", "out_for_delivery", "partially_delivered"] },
    }).sort({ pickedAt: -1 });

    res.json({ success: true, total: orders.length, data: orders });
  } catch (err) {
    console.error("getMyActiveOrders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  3) Completed Orders (history)
//  GET /api/delivery/orders/completed
// ═══════════════════════════════════════════════════════
exports.getCompletedOrders = async (req, res) => {
  try {
    const orders = await DeliveryOrder.find({
      deliveryCompanyId: req.deliveryCompany._id,
      status:            { $in: ["delivered"] },
    }).sort({ deliveredAt: -1 });

    res.json({ success: true, total: orders.length, data: orders });
  } catch (err) {
    console.error("getCompletedOrders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  4) Pick Order — company order uthati hai (rider chala)
//  PUT /api/delivery/orders/:id/pick
// ═══════════════════════════════════════════════════════
exports.pickOrder = async (req, res) => {
  try {
    const order = await DeliveryOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Delivery order not found" });
    }
    if (order.status !== "pending") {
      return res.status(400).json({ success: false, message: "Order already picked or in progress" });
    }

    order.deliveryCompanyId = req.deliveryCompany._id;
    order.status            = "picked";
    order.pickedAt          = new Date();
    await order.save();

    res.json({ success: true, message: "Order picked. You can now deliver.", data: order });
  } catch (err) {
    console.error("pickOrder error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  5) Out for Delivery — rider raaste me
//  PUT /api/delivery/orders/:id/out
// ═══════════════════════════════════════════════════════
exports.markOutForDelivery = async (req, res) => {
  try {
    const order = await DeliveryOrder.findOne({
      _id:               req.params.id,
      deliveryCompanyId: req.deliveryCompany._id,
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.status !== "picked") {
      return res.status(400).json({ success: false, message: "Order must be picked first" });
    }

    order.status = "out_for_delivery";
    await order.save();

    res.json({ success: true, message: "Marked out for delivery.", data: order });
  } catch (err) {
    console.error("markOutForDelivery error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  6) Deliver a single stop (ek buyer ko deliver)
//  PUT /api/delivery/orders/:id/deliver-stop   { buyerOrderId }
// ═══════════════════════════════════════════════════════
exports.deliverStop = async (req, res) => {
  try {
    const { buyerOrderId } = req.body;
    if (!buyerOrderId) {
      return res.status(400).json({ success: false, message: "buyerOrderId required" });
    }

    const order = await DeliveryOrder.findOne({
      _id:               req.params.id,
      deliveryCompanyId: req.deliveryCompany._id,
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const stop = order.deliveries.find(
      (d) => d.buyerOrderId.toString() === buyerOrderId.toString()
    );
    if (!stop) {
      return res.status(404).json({ success: false, message: "Buyer stop not found" });
    }
    if (stop.status === "delivered") {
      return res.status(400).json({ success: false, message: "Already delivered" });
    }

    stop.status      = "delivered";
    stop.deliveredAt = new Date();

    // buyer order → delivered + invoice deliveredAt (return window ke liye)
    await BuyerOrder.findByIdAndUpdate(buyerOrderId, { status: "delivered" });
    await Invoice.findOneAndUpdate(
      { buyerOrderId, invoiceType: "buyer" },
      { deliveryStatus: "delivered", deliveredAt: new Date() }
    );

    // ─── Sab stops deliver ho gaye? ───
    const allDelivered = order.deliveries.every((d) => d.status === "delivered");
    if (allDelivered) {
      order.status      = "delivered";
      order.deliveredAt = new Date();

      // ─── Late? (9 PM grace ke baad deliver hua?) ───
      if (order.graceDeadline && order.deliveredAt > new Date(order.graceDeadline)) {
        order.isLate = true;
        // Kis ki wajah se? Agar supplier late tha (ready late kiya) → supplier;
        // warna rider ne der ki → rider.
        if (order.supplierWasLate) {
          order.lateBy     = "supplier";
          order.lateReason = "supplier_late_preparation";
        } else {
          order.lateBy     = "rider";
          order.lateReason = "rider_late_delivery";
        }
        // NOTE: supplier penalty already markAllReady me lag chuki (agar wo late tha).
        // Rider late ka penalty rider billing me baad me.
      } else {
        order.isLate = false;
        order.lateBy = "none";
      }

      // BulkOrder reference update
      await BulkOrder.findByIdAndUpdate(order.bulkOrderId, { status: "ready" });
    } else {
      order.status = "out_for_delivery";
    }

    await order.save();

    res.json({
      success: true,
      message: allDelivered ? "All delivered! Order complete." : "Stop delivered.",
      data: { status: order.status, allDelivered },
    });
  } catch (err) {
    console.error("deliverStop error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  7) Single order detail
//  GET /api/delivery/orders/:id
// ═══════════════════════════════════════════════════════
exports.getDeliveryOrderDetail = async (req, res) => {
  try {
    const order = await DeliveryOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    console.error("getDeliveryOrderDetail error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};