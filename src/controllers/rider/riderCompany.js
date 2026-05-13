const RiderCompany  = require("../../models/rider/riderCompany");
const DeliveryOrder = require("../../models/rider/deliveryOrder");
const BuyerOrder    = require("../../models/buyer/buyerOrder");
const Invoice       = require("../../models/invoice");
const bcrypt        = require("bcryptjs");
const jwt           = require("jsonwebtoken");

// ═══════════════════════════════════════════════════════
//  RIDER COMPANY — Login
// ═══════════════════════════════════════════════════════
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const company = await RiderCompany.findOne({ email });
    if (!company) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (!company.isActive) {
      return res.status(403).json({ success: false, message: "Account deactivated" });
    }

    const isMatch = await bcrypt.compare(password, company.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: company._id, type: "riderCompany" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      data: {
        _id:   company._id,
        name:  company.name,
        email: company.email,
      },
    });
  } catch (err) {
    console.error("riderCompany login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  RIDER COMPANY — Get Orders (Today + History)
// ═══════════════════════════════════════════════════════
exports.getOrders = async (req, res) => {
  try {
    const { type = "today" } = req.query;

    let filter = {};

    if (type === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filter = {
        status:    { $in: ["pending", "assigned", "picked_up", "at_warehouse"] },
        createdAt: { $gte: today },
      };
    } else {
      filter = { status: "completed" };
    }

    const orders = await DeliveryOrder.find(filter)
      .populate({
        path:     "bulkOrderId",
        populate: [
          { path: "platformItemId", select: "name unit image" },
          { path: "countryId",      select: "name" },
          { path: "winnerSupplierId", select: "managerName phone companyName warehouseAddress" },
        ],
      })
      .sort({ createdAt: -1 });

    const result = orders.map((order) => ({
      deliveryOrderId: order._id,
      status:          order.status,
      bulkOrderId:     order.bulkOrderId?._id,
      item:            order.bulkOrderId?.platformItemId?.name,
      unit:            order.bulkOrderId?.platformItemId?.unit,
      country:         order.bulkOrderId?.countryId?.name,

      // Pickup location
      pickup: {
        supplierName:    order.bulkOrderId?.winnerSupplierId?.companyName,
        supplierPhone:   order.bulkOrderId?.winnerSupplierId?.phone,
        address:         order.pickupLocation?.address,
        lat:             order.pickupLocation?.lat,
        lng:             order.pickupLocation?.lng,
      },

      // Deliveries list
      deliveries: order.deliveries.map((d) => ({
        buyerOrderId:    d.buyerOrderId,
        buyerName:       d.buyerName,
        buyerPhone:      d.buyerPhone,
        deliveryAddress: d.deliveryAddress,
        status:          d.status,
        deliveredAt:     d.deliveredAt,
      })),

      totalDeliveries:     order.deliveries.length,
      completedDeliveries: order.deliveries.filter(d => d.status === "delivered").length,

      assignedAt:  order.assignedAt,
      pickedUpAt:  order.pickedUpAt,
      receivedAt:  order.receivedAt,
      completedAt: order.completedAt,
      createdAt:   order.createdAt,
    }));

    res.json({ success: true, total: result.length, data: result });
  } catch (err) {
    console.error("getOrders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  RIDER COMPANY — Update Order Status
//  PUT /api/rider-company/orders/:deliveryOrderId/status
// ═══════════════════════════════════════════════════════
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, buyerOrderId } = req.body;

    const validStatuses = ["assigned", "picked_up", "at_warehouse", "completed", "failed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be: ${validStatuses.join(", ")}`,
      });
    }

    const deliveryOrder = await DeliveryOrder.findById(req.params.deliveryOrderId);
    if (!deliveryOrder) {
      return res.status(404).json({ success: false, message: "Delivery order not found" });
    }

    const now = new Date();
    const updateData = { status };

    // Timestamps
    if (status === "assigned")    updateData.assignedAt  = now;
    if (status === "picked_up")   updateData.pickedUpAt  = now;
    if (status === "at_warehouse") updateData.receivedAt  = now;
    if (status === "completed")   updateData.completedAt = now;

    // Agar individual buyer deliver kiya
    if (status === "completed" && buyerOrderId) {
      const deliveryIdx = deliveryOrder.deliveries.findIndex(
        (d) => d.buyerOrderId.toString() === buyerOrderId
      );

      if (deliveryIdx !== -1) {
        deliveryOrder.deliveries[deliveryIdx].status      = "delivered";
        deliveryOrder.deliveries[deliveryIdx].deliveredAt = now;
        await deliveryOrder.save();

        // BuyerOrder update
        await BuyerOrder.findByIdAndUpdate(buyerOrderId, { status: "delivered" });

        // Invoice update
        const returnDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        await Invoice.findOneAndUpdate(
          { buyerOrderId, invoiceType: "buyer" },
          {
            deliveryStatus: "delivered",
            deliveredAt:    now,
            returnDeadline,
          }
        );

        // Check if all delivered
        const allDelivered = deliveryOrder.deliveries.every(
          (d) => d.status === "delivered"
        );

        if (allDelivered) {
          await DeliveryOrder.findByIdAndUpdate(deliveryOrder._id, {
            status:      "completed",
            completedAt: now,
          });
        }

        return res.json({
          success: true,
          message: `Delivered to buyer ✅`,
        });
      }
    }

    await DeliveryOrder.findByIdAndUpdate(deliveryOrder._id, updateData);

    res.json({ success: true, message: `Status updated to: ${status}` });
  } catch (err) {
    console.error("updateOrderStatus error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};