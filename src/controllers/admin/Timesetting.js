const SystemSettings = require("../../models/supplier/systemSetting");
const BulkOrder      = require("../../models/BulkOrder");
const Branch         = require("../../models/branch");

// ═══════════════════════════════════════════════════════
//  ADMIN — Get Timeline
//  GET /api/admin/settings/timeline
// ═══════════════════════════════════════════════════════
exports.getTimeline = async (req, res) => {
  try {
    const setting = await SystemSettings.findOne({ key: "supplierTimeline" });

    if (!setting) {
      return res.json({
        success: true,
        data: {
          preparationStart: "18:00",
          preparationEnd:   "10:00",
          pickupStart:      "10:00",
          pickupEnd:        "12:00",
          deliveryStart:    "12:00",
          deliveryEnd:      "20:00",
          maxPrepDays:      2,
        },
      });
    }

    res.json({ success: true, data: setting.value });
  } catch (err) {
    console.error("getTimeline error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Update Timeline
//  PUT /api/admin/settings/timeline
// ═══════════════════════════════════════════════════════
exports.updateTimeline = async (req, res) => {
  try {
    const {
      preparationStart,
      preparationEnd,
      pickupStart,
      pickupEnd,
      deliveryStart,
      deliveryEnd,
      maxPrepDays,
    } = req.body;

    const setting = await SystemSettings.findOneAndUpdate(
      { key: "supplierTimeline" },
      {
        value: {
          preparationStart: preparationStart || "18:00",
          preparationEnd:   preparationEnd   || "10:00",
          pickupStart:      pickupStart      || "10:00",
          pickupEnd:        pickupEnd        || "12:00",
          deliveryStart:    deliveryStart    || "12:00",
          deliveryEnd:      deliveryEnd      || "20:00",
          maxPrepDays:      maxPrepDays      || 2,
        },
        description: "Supplier order preparation timeline",
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: "Timeline updated ✅", data: setting.value });
  } catch (err) {
    console.error("updateTimeline error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Get Late Orders
//  GET /api/admin/settings/late-orders
// ═══════════════════════════════════════════════════════
exports.getLateOrders = async (req, res) => {
  try {
    const lateOrders = await BulkOrder.find({ isLate: true })
      .populate("platformItemId", "name unit")
      .populate("countryId",      "name")
      .populate("winnerSupplierId", "managerName email phone companyName")
      .sort({ createdAt: -1 });

    const result = lateOrders.map((bulk) => ({
      bulkOrderId:  bulk._id,
      item:         bulk.platformItemId?.name,
      country:      bulk.countryId?.name,
      totalQuantity: bulk.totalQuantity,
      winningPrice: bulk.winningPrice,
      status:       bulk.status,
      supplier: {
        name:  bulk.winnerSupplierId?.companyName,
        email: bulk.winnerSupplierId?.email,
        phone: bulk.winnerSupplierId?.phone,
      },
      lateReason: bulk.lateReason,
      readyAt:    bulk.readyAt,
      createdAt:  bulk.createdAt,
    }));

    res.json({ success: true, total: result.length, data: result });
  } catch (err) {
    console.error("getLateOrders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Mark Late Order Resolved
//  PUT /api/admin/settings/late-orders/:bulkOrderId/resolve
// ═══════════════════════════════════════════════════════
exports.resolveLateOrder = async (req, res) => {
  try {
    const { lateReason } = req.body;

    await BulkOrder.findByIdAndUpdate(req.params.bulkOrderId, {
      isLate:     false,
      lateReason: lateReason || null,
    });

    res.json({ success: true, message: "Late order resolved ✅" });
  } catch (err) {
    console.error("resolveLateOrder error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};