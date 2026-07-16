// 📁 src/controllers/admin/commissionSettings.js
const { getCommissionSettings, updateCommissionSettings } = require("../../cron/commissionSettingService");

// ═══════════════════════════════════════════════════════
//  GET /api/admin/commission-settings
// ═══════════════════════════════════════════════════════
exports.getSettings = async (req, res) => {
  try {
    const settings = await getCommissionSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error("getCommissionSettings error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  PUT /api/admin/commission-settings
//  Body: { platformCommission, deliveryFee, supplierPenalty, buyerPaymentDays, supplierPaymentDays }
// ═══════════════════════════════════════════════════════
exports.updateSettings = async (req, res) => {
  try {
    const {
      platformCommission,
      deliveryFee,
      supplierPenalty,
      buyerPaymentDays,
      supplierPaymentDays,
    } = req.body;

    // ─── Validation ──────────────────────────────────
    const isValidPercent = (v) =>
      v === undefined || (typeof v === "number" && v >= 0 && v <= 100);
    const isValidDays = (v) =>
      v === undefined || (Number.isInteger(v) && v >= 1 && v <= 365);

    if (!isValidPercent(platformCommission)) {
      return res.status(400).json({ success: false, message: "platformCommission must be 0–100" });
    }
    if (!isValidPercent(deliveryFee)) {
      return res.status(400).json({ success: false, message: "deliveryFee must be 0–100" });
    }
    if (!isValidPercent(supplierPenalty)) {
      return res.status(400).json({ success: false, message: "supplierPenalty must be 0–100" });
    }
    if (!isValidDays(buyerPaymentDays)) {
      return res.status(400).json({ success: false, message: "buyerPaymentDays must be 1–365" });
    }
    if (!isValidDays(supplierPaymentDays)) {
      return res.status(400).json({ success: false, message: "supplierPaymentDays must be 1–365" });
    }

    // ─── Build update object (sirf jo bheja gaya) ────
    const updates = {};
    if (platformCommission  !== undefined) updates.platformCommission  = platformCommission;
    if (deliveryFee         !== undefined) updates.deliveryFee         = deliveryFee;
    if (supplierPenalty     !== undefined) updates.supplierPenalty     = supplierPenalty;
    if (buyerPaymentDays    !== undefined) updates.buyerPaymentDays    = buyerPaymentDays;
    if (supplierPaymentDays !== undefined) updates.supplierPaymentDays = supplierPaymentDays;

    const updated = await updateCommissionSettings(updates);

    res.json({
      success: true,
      message: "Commission settings updated ✅",
      data: updated,
    });
  } catch (err) {
    console.error("updateCommissionSettings error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
