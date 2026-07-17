// 📁 controllers/admin/platformCommission.js
// Platform ka asal 2% commission — Invoice.commissionAmount se seedha, client-side
// recompute nahi (jo returns/deductions ko account nahi karta tha aur galat 3% dikhata tha).
const Invoice = require("../../models/invoice");

// ═══════════════════════════════════════════════════════
//  GET /api/admin/commission-records
//  Per bulk order — platform's 2% commission (Invoice.commissionAmount).
//  Rider's 1% (deliveryAmount) is intentionally NOT included here —
//  see /api/admin/rider-earnings for that.
// ═══════════════════════════════════════════════════════
exports.getCommissionRecords = async (req, res) => {
  try {
    const summary = await Invoice.aggregate([
      { $match: { invoiceType: "buyer" } },
      {
        $group: {
          _id:               "$bulkOrderId",
          buyerCount:        { $sum: 1 },
          totalQuantity:     { $sum: "$quantity" },
          totalCommission:   { $sum: "$commissionAmount" }, // 2% — platform's actual earning
          totalDeliveryFee:  { $sum: "$deliveryAmount" },   // 1% — rider's (reference only)
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
          totalCommission:  { $round: ["$totalCommission",  2] },
          totalDeliveryFee: { $round: ["$totalDeliveryFee", 2] },
          totalBuyerPaid:   { $round: ["$totalBuyerPaid",   2] },
          bidDate:          1,
          createdAt:        1,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    const overall = {
      totalCommission:  Math.round(summary.reduce((s, r) => s + (r.totalCommission  || 0), 0) * 100) / 100,
      totalDeliveryFee: Math.round(summary.reduce((s, r) => s + (r.totalDeliveryFee || 0), 0) * 100) / 100,
      totalBuyerPaid:   Math.round(summary.reduce((s, r) => s + (r.totalBuyerPaid   || 0), 0) * 100) / 100,
    };

    res.json({ success: true, overall, total: summary.length, data: summary });
  } catch (err) {
    console.error("getCommissionRecords error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
