const Rider         = require("../../models/rider/rider");
const DeliveryOrder = require("../../models/rider/deliveryOrder");
const BuyerOrder    = require("../../models/buyer/buyerOrder");
const Invoice       = require("../../models/invoice");
const bcrypt        = require("bcrypt");
const jwt           = require("jsonwebtoken");

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const rider = await Rider.findOne({ email });
    if (!rider || !rider.isActive) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const isMatch = await bcrypt.compare(password, rider.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: rider._id, type: "rider" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      data: { _id: rider._id, name: rider.name, email: rider.email },
    });
  } catch (err) {
    console.error("rider login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update Location
exports.updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: "lat and lng required" });
    }

    await Rider.findByIdAndUpdate(req.rider._id, {
      currentLocation: { lat, lng, updatedAt: new Date() },
      status:          "online",
    });

    res.json({ success: true, message: "Location updated" });
  } catch (err) {
    console.error("updateLocation error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get My Assigned Order
exports.getMyOrder = async (req, res) => {
  try {
    const deliveryOrder = await DeliveryOrder.findOne({
      riderId: req.rider._id,
      status:  { $in: ["assigned", "picked_up", "at_warehouse"] },
    });

    if (!deliveryOrder) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: deliveryOrder });
  } catch (err) {
    console.error("getMyOrder error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Accept Order
exports.acceptOrder = async (req, res) => {
  try {
    const deliveryOrder = await DeliveryOrder.findOne({
      _id:     req.params.deliveryOrderId,
      riderId: req.rider._id,
      status:  "assigned",
    });

    if (!deliveryOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    await Rider.findByIdAndUpdate(req.rider._id, { status: "busy" });

    res.json({
      success:        true,
      message:        "Order accepted! Go to pickup location",
      pickupLocation: deliveryOrder.pickupLocation,
    });
  } catch (err) {
    console.error("acceptOrder error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Mark Picked Up
exports.markPickedUp = async (req, res) => {
  try {
    const deliveryOrder = await DeliveryOrder.findOne({
      _id:     req.params.deliveryOrderId,
      riderId: req.rider._id,
      status:  "assigned",
    });

    if (!deliveryOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    await DeliveryOrder.findByIdAndUpdate(deliveryOrder._id, {
      status:     "picked_up",
      pickedUpAt: new Date(),
    });

    const sorted = deliveryOrder.deliveries
      .filter((d) => d.status === "pending")
      .sort((a, b) =>
        (a.deliveryAddress?.area || "").localeCompare(b.deliveryAddress?.area || "")
      );

    res.json({
      success:    true,
      message:    "Orders picked up from supplier!",
      deliveries: sorted,
    });
  } catch (err) {
    console.error("markPickedUp error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Received at Rider Warehouse
exports.markReceivedAtWarehouse = async (req, res) => {
  try {
    const deliveryOrder = await DeliveryOrder.findOne({
      _id:     req.params.deliveryOrderId,
      riderId: req.rider._id,
      status:  "picked_up",
    });

    if (!deliveryOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    await DeliveryOrder.findByIdAndUpdate(deliveryOrder._id, {
      status:     "at_warehouse",
      receivedAt: new Date(),
    });

    // Area wise sorted list with buyer info
    const deliveryList = deliveryOrder.deliveries
      .filter((d) => d.status === "pending")
      .sort((a, b) =>
        (a.deliveryAddress?.area || "").localeCompare(b.deliveryAddress?.area || "")
      )
      .map((d) => ({
        buyerOrderId:    d.buyerOrderId,
        buyerName:       d.buyerName,
        buyerPhone:      d.buyerPhone,
        deliveryAddress: d.deliveryAddress,
        distanceKm:      d.distanceKm,
        deliveryCharge:  d.deliveryCharge,
      }));

    res.json({
      success:      true,
      message:      "Orders received at warehouse! Start delivering",
      deliveryList,
    });
  } catch (err) {
    console.error("markReceivedAtWarehouse error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Mark Delivered per buyer
exports.markDelivered = async (req, res) => {
  try {
    const deliveryOrder = await DeliveryOrder.findOne({
      _id:     req.params.deliveryOrderId,
      riderId: req.rider._id,
      status:  "at_warehouse",
    });

    if (!deliveryOrder) {
      return res.status(404).json({ success: false, message: "Delivery order not found" });
    }

    const delivery = deliveryOrder.deliveries.find(
      (d) => d.buyerOrderId.toString() === req.params.buyerOrderId
    );

    if (!delivery) {
      return res.status(404).json({ success: false, message: "Buyer delivery not found" });
    }

    delivery.status      = "delivered";
    delivery.deliveredAt = new Date();
    await deliveryOrder.save();

    await BuyerOrder.findByIdAndUpdate(req.params.buyerOrderId, {
      status: "delivered",
    });

    const returnDeadline = new Date();
    returnDeadline.setHours(returnDeadline.getHours() + 24);

    await Invoice.findOneAndUpdate(
      { buyerOrderId: req.params.buyerOrderId },
      {
        deliveryStatus:  "delivered",
        deliveredAt:     new Date(),
        returnDeadline,
      }
    );

    // Sab done?
    const allDone = deliveryOrder.deliveries.every((d) => d.status === "delivered");
    if (allDone) {
      await DeliveryOrder.findByIdAndUpdate(deliveryOrder._id, {
        status:      "completed",
        completedAt: new Date(),
      });
      await Rider.findByIdAndUpdate(req.rider._id, { status: "online" });
    }

    res.json({ success: true, message: "Delivered successfully ✅" });
  } catch (err) {
    console.error("markDelivered error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delivery History
exports.getHistory = async (req, res) => {
  try {
    const orders = await DeliveryOrder.find({ riderId: req.rider._id })
      .sort({ createdAt: -1 });

    const result = orders.map((d) => ({
      deliveryOrderId: d._id,
      status:          d.status,
      totalDeliveries: d.deliveries.length,
      delivered:       d.deliveries.filter((dl) => dl.status === "delivered").length,
      failed:          d.deliveries.filter((dl) => dl.status === "failed").length,
      pickedUpAt:      d.pickedUpAt,
      completedAt:     d.completedAt,
    }));

    res.json({ success: true, total: result.length, data: result });
  } catch (err) {
    console.error("getHistory error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};