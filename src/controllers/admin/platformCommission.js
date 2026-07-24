// 📁 controllers/admin/platformCommission.js
// Platform ka commission — Invoice.commissionAmount se seedha (jo har invoice ke
// banne ke waqt jo bhi settings live thi usi % se calculate hua tha).
// % labels hardcode NAHI karte — settings badal sakti hain, isliye live settings +
// actual data se derive kiya hua effective % dono bhejte hain.
const Invoice = require("../../models/invoice");
const LedgerEntry = require("../../models/ledger/LedgerEntry");
const { getCommissionSettings } = require("../../cron/commissionSettingService");

// ═══════════════════════════════════════════════════════
//  GET /api/admin/commission-records
//  Per bulk order — platform's commission (Invoice.commissionAmount).
//  Rider's fee (deliveryAmount) is intentionally NOT counted as platform revenue —
//  see /api/admin/rider-earnings for that.
// ═══════════════════════════════════════════════════════
exports.getCommissionRecords = async (req, res) => {
  try {
    const settings = await getCommissionSettings(); // current live % (for NEW orders)

    const summary = await Invoice.aggregate([
      { $match: { invoiceType: "buyer" } },
      {
        $group: {
          _id:               "$bulkOrderId",
          buyerCount:        { $sum: { $cond: [{ $eq: ["$paymentStatus", "cancelled"] }, 0, 1] } },
          totalQuantity:     { $sum: { $cond: [{ $eq: ["$paymentStatus", "cancelled"] }, 0, "$quantity"] } },
          // Cancelled invoices (return resolved, supplier guilty) don't count — buyer never
          // paid for these, so platform never earned commission on them either.
          totalAmount:       { $sum: { $cond: [{ $eq: ["$paymentStatus", "cancelled"] }, 0, "$totalAmount"] } },
          totalCommission:   { $sum: { $cond: [
            { $and: [{ $eq: ["$paymentStatus", "cancelled"] }, { $ne: ["$returnReason", "rider_guilty"] }] },
            0,
            "$commissionAmount",
          ] } },
          totalBuyerPaid:    { $sum: { $cond: [{ $eq: ["$paymentStatus", "cancelled"] }, 0, "$grandTotal"] } },
          totalCancelled:    { $sum: { $cond: [{ $eq: ["$paymentStatus", "cancelled"] }, "$grandTotal", 0] } },
          pricePerUnit:      { $first: "$pricePerUnit" },
          bidDate:           { $min: "$bidDate" },
          createdAt:         { $min: "$createdAt" },
        },
      },
      {
        $lookup: { from: "bulkorders", localField: "_id", foreignField: "_id", as: "bulk" },
      },
      { $unwind: { path: "$bulk", preserveNullAndEmptyArrays: true } },
      {
        $lookup: { from: "platformitems", localField: "bulk.platformItemId", foreignField: "_id", as: "item" },
      },
      { $unwind: { path: "$item", preserveNullAndEmptyArrays: true } },
      {
        $lookup: { from: "countries", localField: "bulk.countryId", foreignField: "_id", as: "country" },
      },
      { $unwind: { path: "$country", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          bulkOrderId:      "$_id",
          item:             "$item.name",
          image:            "$item.image",
          unit:             "$item.unit",
          country:          "$country.name",
          buyerCount:       1,
          totalQuantity:    1,
          winningPrice:     "$bulk.winningPrice",
          pricePerUnit:     1,
          totalAmount:      { $round: ["$totalAmount",      2] },
          totalCommission:  { $round: ["$totalCommission",  2] },
          totalBuyerPaid:   { $round: ["$totalBuyerPaid",   2] },
          totalCancelled:   { $round: ["$totalCancelled",   2] },
          bidDate:          1,
          createdAt:        1,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    // Rider ki ASAL earning — ledger se (delivery_fee + return_leg_fee dono), bulkOrderId ke
    // hisaab se group kiya. Ye Invoice.deliveryAmount (jo sirf order-placement waqt ka static
    // "reference" tha) se zyada accurate hai — return-leg ki extra fee bhi shamil hoti hai,
    // aur sirf actually-hui deliveries ka paisa ginta hai (undelivered orders ka nahi).
    const riderLedgerRows = await LedgerEntry.aggregate([
      { $match: { entityType: "rider", category: { $in: ["delivery_fee", "return_leg_fee"] } } },
      { $group: { _id: "$bulkOrderId", total: { $sum: "$amount" } } },
    ]);
    const riderFeeByBulk = {};
    riderLedgerRows.forEach(r => { if (r._id) riderFeeByBulk[r._id.toString()] = r.total; });

    // Har row ka apna effective % — jo actually us order ke waqt lagi thi (settings
    // badalne se purane orders ka displayed % kabhi galat nahi hoga)
    const withPct = summary.map(r => {
      const totalDeliveryFee = Math.round((riderFeeByBulk[r.bulkOrderId?.toString()] || 0) * 100) / 100;
      return {
        ...r,
        totalDeliveryFee,
        commissionPct:  r.totalAmount > 0 ? Math.round((r.totalCommission  / r.totalAmount) * 1000) / 10 : 0,
        deliveryFeePct: r.totalAmount > 0 ? Math.round((totalDeliveryFee    / r.totalAmount) * 1000) / 10 : 0,
      };
    });

    const overall = {
      totalAmount:      Math.round(withPct.reduce((s, r) => s + (r.totalAmount      || 0), 0) * 100) / 100,
      totalCommission:  Math.round(withPct.reduce((s, r) => s + (r.totalCommission  || 0), 0) * 100) / 100,
      totalDeliveryFee: Math.round(withPct.reduce((s, r) => s + (r.totalDeliveryFee || 0), 0) * 100) / 100,
      totalBuyerPaid:   Math.round(withPct.reduce((s, r) => s + (r.totalBuyerPaid   || 0), 0) * 100) / 100,
      totalCancelled:   Math.round(withPct.reduce((s, r) => s + (r.totalCancelled   || 0), 0) * 100) / 100,
    };
    // Overall effective % — actual weighted average across all records shown
    overall.commissionPct  = overall.totalAmount > 0 ? Math.round((overall.totalCommission  / overall.totalAmount) * 1000) / 10 : settings.platformCommission;
    overall.deliveryFeePct = overall.totalAmount > 0 ? Math.round((overall.totalDeliveryFee / overall.totalAmount) * 1000) / 10 : settings.deliveryFee;

    res.json({
      success: true,
      overall,
      currentSettings: { platformCommission: settings.platformCommission, deliveryFee: settings.deliveryFee }, // for NEW orders going forward
      total: withPct.length,
      data: withPct,
    });
  } catch (err) {
    console.error("getCommissionRecords error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};