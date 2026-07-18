// 📁 controllers/admin/platformCommission.js
// Platform ka asal 2% commission — Invoice.commissionAmount se seedha, client-side
// recompute nahi (jo returns/deductions ko account nahi karta tha aur galat 3% dikhata tha).
const Invoice = require("../../models/invoice");
const { getCommissionSettings } = require("../../cron/commissionSettingService");
// ═══════════════════════════════════════════════════════
//  GET /api/admin/commission-records
//  Per bulk order — platform's 2% commission (Invoice.commissionAmount).
//  Rider's 1% (deliveryAmount) is intentionally NOT included here —
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
          buyerCount:        { $sum: 1 },
          totalQuantity:     { $sum: "$quantity" },
          totalAmount:       { $sum: "$totalAmount" },     // raw order value, before fees
          totalCommission:   { $sum: "$commissionAmount" }, // platform's actual earning (whatever % was live then)
          totalDeliveryFee:  { $sum: "$deliveryAmount" },   // rider's fee (reference only)
          totalBuyerPaid:    { $sum: "$grandTotal" },
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
          totalDeliveryFee: { $round: ["$totalDeliveryFee", 2] },
          totalBuyerPaid:   { $round: ["$totalBuyerPaid",   2] },
          bidDate:          1,
          createdAt:        1,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
 
    // Har row ka apna effective % — jo actually us order ke waqt lagi thi (settings
    // badalne se purane orders ka displayed % kabhi galat nahi hoga)
    const withPct = summary.map(r => ({
      ...r,
      commissionPct:  r.totalAmount > 0 ? Math.round((r.totalCommission  / r.totalAmount) * 1000) / 10 : 0,
      deliveryFeePct: r.totalAmount > 0 ? Math.round((r.totalDeliveryFee / r.totalAmount) * 1000) / 10 : 0,
    }));
 
    const overall = {
      totalAmount:      Math.round(withPct.reduce((s, r) => s + (r.totalAmount      || 0), 0) * 100) / 100,
      totalCommission:  Math.round(withPct.reduce((s, r) => s + (r.totalCommission  || 0), 0) * 100) / 100,
      totalDeliveryFee: Math.round(withPct.reduce((s, r) => s + (r.totalDeliveryFee || 0), 0) * 100) / 100,
      totalBuyerPaid:   Math.round(withPct.reduce((s, r) => s + (r.totalBuyerPaid   || 0), 0) * 100) / 100,
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
 