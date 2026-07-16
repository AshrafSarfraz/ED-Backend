// 📁 src/controllers/admin/deliverySettings.js
const { getDeliverySettings, updateDeliverySettings } = require("../../cron/deliverySettingService");

// ═══════════════════════════════════════════════════════
//  GET /api/admin/delivery-settings
// ═══════════════════════════════════════════════════════
exports.getSettings = async (req, res) => {
  try {
    const settings = await getDeliverySettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error("getDeliverySettings error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  PUT /api/admin/delivery-settings
//  Body: { pickupStartHour, pickupEndHour, deliverDeadlineHour, graceHour }
// ═══════════════════════════════════════════════════════
exports.updateSettings = async (req, res) => {
  try {
    const { pickupStartHour, pickupEndHour, deliverDeadlineHour, graceHour } = req.body;

    // Validation — 0-23 range
    const isValidHour = (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 23);

    if (!isValidHour(pickupStartHour))     return res.status(400).json({ success: false, message: "pickupStartHour must be 0–23" });
    if (!isValidHour(pickupEndHour))       return res.status(400).json({ success: false, message: "pickupEndHour must be 0–23" });
    if (!isValidHour(deliverDeadlineHour)) return res.status(400).json({ success: false, message: "deliverDeadlineHour must be 0–23" });
    if (!isValidHour(graceHour))           return res.status(400).json({ success: false, message: "graceHour must be 0–23" });

    // Cross-field validation
    const current = await getDeliverySettings();
    const next = {
      ...current,
      ...(pickupStartHour     !== undefined && { pickupStartHour }),
      ...(pickupEndHour       !== undefined && { pickupEndHour }),
      ...(deliverDeadlineHour !== undefined && { deliverDeadlineHour }),
      ...(graceHour           !== undefined && { graceHour }),
    };

    if (next.pickupEndHour <= next.pickupStartHour)
      return res.status(400).json({ success: false, message: "Pickup end must be after pickup start" });
    if (next.deliverDeadlineHour <= next.pickupEndHour)
      return res.status(400).json({ success: false, message: "Deliver deadline must be after pickup end" });
    if (next.graceHour <= next.deliverDeadlineHour)
      return res.status(400).json({ success: false, message: "Grace hour must be after deliver deadline" });

    const updated = await updateDeliverySettings(next);
    res.json({ success: true, message: "Delivery settings updated ✅", data: updated });
  } catch (err) {
    console.error("updateDeliverySettings error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
