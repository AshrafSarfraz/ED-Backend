// // // 📁 controllers/admin/adminSupplierPayment.js
// // const Invoice     = require("../../models/invoice");
// // const BulkOrder   = require("../../models/BulkOrder");
// // const Branch      = require("../../models/Branch");

// // const DAY_MS      = 24 * 60 * 60 * 1000;
// // const PAYMENT_DAYS = 60; // payment deadline


// // exports.getPaymentDays = async (req, res) => {
// //   try {
// //     // All supplier invoices — pending or released
// //     const invoices = await Invoice.find({ invoiceType: "supplier" })
// //       .populate("supplierBranchId", "managerName companyName")
// //       .populate("bulkOrderId",      "status totalQuantity winningPrice readyAt")
// //       .populate("platformItemId",   "name unit image")
// //       .populate("countryId",        "name")
// //       .lean();

// //     // Group by date (createdAt date of invoice = day bidding was won)
// //     const dayMap = {};

// //     invoices.forEach(inv => {
// //       const dateKey = new Date(inv.createdAt).toISOString().slice(0, 10);

// //       if (!dayMap[dateKey]) {
// //         dayMap[dateKey] = {
// //           date:           dateKey,
// //           dateLabel:      new Date(dateKey).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
// //           deadline:       new Date(new Date(dateKey).getTime() + PAYMENT_DAYS * DAY_MS).toISOString().slice(0, 10),
// //           daysLeft:       Math.ceil((new Date(dateKey).getTime() + PAYMENT_DAYS * DAY_MS - Date.now()) / DAY_MS),
// //           totalBulkOrders: 0,
// //           totalPending:   0,
// //           totalReleased:  0,
// //           totalAmount:    0,
// //           bulkOrderCount: new Set(),
// //         };
// //       }

// //       const d = dayMap[dateKey];
// //       d.bulkOrderCount.add(inv.bulkOrderId?._id?.toString());
// //       d.totalAmount   += inv.grandTotal || 0;

// //       if (inv.supplierPaymentStatus === "released") {
// //         d.totalReleased += inv.grandTotal || 0;
// //       } else {
// //         d.totalPending  += inv.grandTotal || 0;
// //       }
// //     });

// //     const result = Object.values(dayMap)
// //       .map(d => ({
// //         ...d,
// //         totalBulkOrders: d.bulkOrderCount.size,
// //         totalAmount:    Math.round(d.totalAmount   * 100) / 100,
// //         totalPending:   Math.round(d.totalPending  * 100) / 100,
// //         totalReleased:  Math.round(d.totalReleased * 100) / 100,
// //         isOverdue:      d.daysLeft < 0,
// //         isUrgent:       d.daysLeft >= 0 && d.daysLeft <= 7,
// //         fullyPaid:      Math.round(d.totalPending * 100) / 100 === 0,
// //         bulkOrderCount: undefined, // Set remove karo
// //       }))
// //       .sort((a, b) => b.date.localeCompare(a.date));

// //     // Overall summary
// //     const overall = {
// //       totalPending:  Math.round(result.reduce((s, r) => s + r.totalPending,  0) * 100) / 100,
// //       totalReleased: Math.round(result.reduce((s, r) => s + r.totalReleased, 0) * 100) / 100,
// //       totalAmount:   Math.round(result.reduce((s, r) => s + r.totalAmount,   0) * 100) / 100,
// //       overdueDays:   result.filter(r => r.isOverdue && !r.fullyPaid).length,
// //       urgentDays:    result.filter(r => r.isUrgent  && !r.fullyPaid).length,
// //     };

// //     res.json({ success: true, overall, total: result.length, data: result });
// //   } catch (err) {
// //     console.error("getPaymentDays error:", err);
// //     res.status(500).json({ success: false, message: "Server error" });
// //   }
// // };

// // // ═══════════════════════════════════════════════════════
// // //  ADMIN — Bulk Orders for a specific date
// // //  GET /api/admin/supplier-payments/days/:date/bulk-orders
// // //  Returns: all bulk orders for that date with supplier breakdown
// // // ═══════════════════════════════════════════════════════
// // exports.getDayBulkOrders = async (req, res) => {
// //   try {
// //     const { date } = req.params; // "2026-06-15"

// //     const start = new Date(date); start.setHours(0, 0, 0, 0);
// //     const end   = new Date(date); end.setHours(23, 59, 59, 999);

// //     const invoices = await Invoice.find({
// //       invoiceType: "supplier",
// //       createdAt:   { $gte: start, $lte: end },
// //     })
// //       .populate("supplierBranchId", "managerName companyName phone email bankDetails")
// //       .populate("bulkOrderId",      "totalQuantity winningPrice status readyAt")
// //       .populate("platformItemId",   "name unit image")
// //       .populate("countryId",        "name")
// //       .populate("buyerBranchId",    "managerName companyName")
// //       .lean();

// //     // Group by bulkOrderId
// //     const bulkMap = {};

// //     invoices.forEach(inv => {
// //       const bulkId = inv.bulkOrderId?._id?.toString() || "unknown";

// //       if (!bulkMap[bulkId]) {
// //         bulkMap[bulkId] = {
// //           bulkOrderId:    bulkId,
// //           orderRef:       `#ORD-${bulkId.slice(-6).toUpperCase()}`,
// //           item:           inv.platformItemId?.name,
// //           image:          inv.platformItemId?.image,
// //           unit:           inv.platformItemId?.unit,
// //           country:        inv.countryId?.name,
// //           totalQuantity:  inv.bulkOrderId?.totalQuantity,
// //           winningPrice:   inv.bulkOrderId?.winningPrice,
// //           bulkStatus:     inv.bulkOrderId?.status,
// //           readyAt:        inv.bulkOrderId?.readyAt,

// //           // supplier info (same for all invoices in this bulk)
// //           supplierName:    inv.supplierBranchId?.managerName,
// //           supplierCompany: inv.supplierBranchId?.companyName,
// //           supplierPhone:   inv.supplierBranchId?.phone,
// //           supplierEmail:   inv.supplierBranchId?.email,
// //           supplierBank:    inv.supplierBranchId?.bankDetails || null,
// //           supplierBranchId: inv.supplierBranchId?._id,

// //           buyerOrders: [],
// //           totalAmount:   0,
// //           totalPending:  0,
// //           totalReleased: 0,
// //           fullyPaid:     false,
// //         };
// //       }

// //       const b = bulkMap[bulkId];
// //       const released = inv.supplierPaymentStatus === "released";

// //       b.buyerOrders.push({
// //         invoiceId:     inv._id,
// //         invoiceNumber: inv.invoiceNumber,
// //         buyerName:     inv.buyerBranchId?.managerName,
// //         buyerCompany:  inv.buyerBranchId?.companyName,
// //         quantity:      inv.quantity,
// //         pricePerUnit:  inv.pricePerUnit,
// //         amount:        Math.round(inv.grandTotal * 100) / 100,
// //         status:        inv.supplierPaymentStatus,
// //         paidAt:        inv.supplierPaidAt || null,
// //       });

// //       b.totalAmount   += inv.grandTotal || 0;
// //       if (released) b.totalReleased += inv.grandTotal || 0;
// //       else          b.totalPending  += inv.grandTotal || 0;
// //     });

// //     const result = Object.values(bulkMap).map(b => ({
// //       ...b,
// //       totalAmount:   Math.round(b.totalAmount   * 100) / 100,
// //       totalPending:  Math.round(b.totalPending  * 100) / 100,
// //       totalReleased: Math.round(b.totalReleased * 100) / 100,
// //       fullyPaid:     Math.round(b.totalPending  * 100) / 100 === 0,
// //       buyerCount:    b.buyerOrders.length,
// //     }));

// //     // Day totals
// //     const dayTotal = {
// //       totalAmount:   Math.round(result.reduce((s, r) => s + r.totalAmount,   0) * 100) / 100,
// //       totalPending:  Math.round(result.reduce((s, r) => s + r.totalPending,  0) * 100) / 100,
// //       totalReleased: Math.round(result.reduce((s, r) => s + r.totalReleased, 0) * 100) / 100,
// //       bulkOrderCount: result.length,
// //       deadline:      new Date(new Date(date).getTime() + PAYMENT_DAYS * DAY_MS).toISOString().slice(0, 10),
// //       daysLeft:      Math.ceil((new Date(date).getTime() + PAYMENT_DAYS * DAY_MS - Date.now()) / DAY_MS),
// //     };

// //     res.json({ success: true, date, dayTotal, total: result.length, data: result });
// //   } catch (err) {
// //     console.error("getDayBulkOrders error:", err);
// //     res.status(500).json({ success: false, message: "Server error" });
// //   }
// // };

// // // ═══════════════════════════════════════════════════════
// // //  ADMIN — Pay Supplier (single bulk order OR all bulk orders of a day)
// // //  POST /api/admin/supplier-payments/pay
// // //  Body: { bulkOrderId } OR { date }  (ek dono me se)
// // //  + { note, transactionRef }
// // // ═══════════════════════════════════════════════════════
// // exports.paySupplier = async (req, res) => {
// //   try {
// //     const { bulkOrderId, date, note, transactionRef } = req.body;

// //     if (!bulkOrderId && !date) {
// //       return res.status(400).json({ success: false, message: "bulkOrderId or date required" });
// //     }

// //     let filter = { invoiceType: "supplier", supplierPaymentStatus: "pending" };

// //     if (bulkOrderId) {
// //       // Single bulk order ka payment
// //       const bulk = await BulkOrder.findById(bulkOrderId);
// //       if (!bulk) {
// //         return res.status(404).json({ success: false, message: "Bulk order not found" });
// //       }
// //       // Find all supplier invoices for this bulk
// //       const invoiceIds = await Invoice.find({
// //         bulkOrderId,
// //         invoiceType: "supplier",
// //         supplierPaymentStatus: "pending",
// //       }).select("_id");

// //       filter = { _id: { $in: invoiceIds.map(i => i._id) } };
// //     } else {
// //       // All bulk orders of a day
// //       const start = new Date(date); start.setHours(0, 0, 0, 0);
// //       const end   = new Date(date); end.setHours(23, 59, 59, 999);
// //       filter.createdAt = { $gte: start, $lte: end };
// //     }

// //     const invoices = await Invoice.find(filter);

// //     if (invoices.length === 0) {
// //       return res.status(400).json({ success: false, message: "No pending supplier invoices found" });
// //     }

// //     const now = new Date();
// //     let totalPaid = 0;

// //     await Promise.all(invoices.map(async inv => {
// //       await Invoice.findByIdAndUpdate(inv._id, {
// //         supplierPaymentStatus: "released",
// //         supplierPaidAt:        now,
// //         amountDue:             0,
// //         amountPaid:            inv.grandTotal,
// //       });
// //       totalPaid += inv.grandTotal;
// //     }));

// //     res.json({
// //       success: true,
// //       message: `✅ Payment released to ${invoices.length} supplier invoice(s).`,
// //       data: {
// //         invoiceCount:   invoices.length,
// //         totalPaid:      Math.round(totalPaid * 100) / 100,
// //         paidAt:         now,
// //         note:           note || null,
// //         transactionRef: transactionRef || null,
// //       },
// //     });
// //   } catch (err) {
// //     console.error("paySupplier error:", err);
// //     res.status(500).json({ success: false, message: "Server error" });
// //   }
// // };

// // // ═══════════════════════════════════════════════════════
// // //  ADMIN — Supplier Payment Records (per supplier)
// // //  GET /api/admin/supplier-payments/suppliers
// // // ═══════════════════════════════════════════════════════
// // exports.getSupplierPaymentRecords = async (req, res) => {
// //   try {
// //     const summary = await Invoice.aggregate([
// //       { $match: { invoiceType: "supplier" } },
// //       {
// //         $group: {
// //           _id:           "$supplierBranchId",
// //           totalEarned:   { $sum: "$grandTotal" },
// //           totalReleased: { $sum: { $cond: [{ $eq: ["$supplierPaymentStatus", "released"] }, "$grandTotal", 0] } },
// //           totalPending:  { $sum: { $cond: [{ $ne: ["$supplierPaymentStatus", "released"] }, "$grandTotal", 0] } },
// //           invoiceCount:  { $sum: 1 },
// //           pendingCount:  { $sum: { $cond: [{ $ne: ["$supplierPaymentStatus", "released"] }, 1, 0] } },
// //           lastActivity:  { $max: "$createdAt" },
// //         },
// //       },
// //       {
// //         $lookup: {
// //           from:         "branches",
// //           localField:   "_id",
// //           foreignField: "_id",
// //           as:           "branch",
// //         },
// //       },
// //       { $unwind: { path: "$branch", preserveNullAndEmpty: true } },
// //       {
// //         $project: {
// //           branchId:     "$_id",
// //           supplierName: "$branch.managerName",
// //           companyName:  "$branch.companyName",
// //           email:        "$branch.email",
// //           phone:        "$branch.phone",
// //           bankDetails:  "$branch.bankDetails",
// //           totalEarned:   { $round: ["$totalEarned",   2] },
// //           totalReleased: { $round: ["$totalReleased", 2] },
// //           totalPending:  { $round: ["$totalPending",  2] },
// //           invoiceCount: 1,
// //           pendingCount: 1,
// //           lastActivity: 1,
// //         },
// //       },
// //       { $sort: { totalPending: -1 } },
// //     ]);

// //     res.json({ success: true, total: summary.length, data: summary });
// //   } catch (err) {
// //     console.error("getSupplierPaymentRecords error:", err);
// //     res.status(500).json({ success: false, message: "Server error" });
// //   }
// // };

// // 📁 controllers/admin/adminSupplierPayment.js
// const Invoice     = require("../../models/invoice");
// const BulkOrder   = require("../../models/BulkOrder");
// const Branch      = require("../../models/Branch");
// const { getCommissionSettings } = require("../../cron/commissionSettingService");

// const DAY_MS = 24 * 60 * 60 * 1000;

// // Helper — DB se payment days lao (cache nahi — fresh fetch)
// const getPaymentDays = async () => {
//   const s = await getCommissionSettings();
//   return s.supplierPaymentDays || 60;
// };


// exports.getPaymentDays = async (req, res) => {
//   try {
//     const PAYMENT_DAYS = await getPaymentDays(); // ← DB se fetch
//     // All supplier invoices — pending or released
//     const invoices = await Invoice.find({ invoiceType: "supplier" })
//       .populate("supplierBranchId", "managerName companyName")
//       .populate("bulkOrderId",      "status totalQuantity winningPrice readyAt")
//       .populate("platformItemId",   "name unit image")
//       .populate("countryId",        "name")
//       .lean();

//     // Group by date (createdAt date of invoice = day bidding was won)
//     const dayMap = {};

//     invoices.forEach(inv => {
//       const dateKey = new Date(inv.createdAt).toISOString().slice(0, 10);

//       if (!dayMap[dateKey]) {
//         dayMap[dateKey] = {
//           date:           dateKey,
//           dateLabel:      new Date(dateKey).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
//           deadline:       new Date(new Date(dateKey).getTime() + PAYMENT_DAYS * DAY_MS).toISOString().slice(0, 10),
//           daysLeft:       Math.ceil((new Date(dateKey).getTime() + PAYMENT_DAYS * DAY_MS - Date.now()) / DAY_MS),
//           totalBulkOrders: 0,
//           totalPending:   0,
//           totalReleased:  0,
//           totalAmount:    0,
//           bulkOrderCount: new Set(),
//         };
//       }

//       const d = dayMap[dateKey];
//       d.bulkOrderCount.add(inv.bulkOrderId?._id?.toString());
//       d.totalAmount   += inv.grandTotal || 0;

//       if (inv.supplierPaymentStatus === "released") {
//         d.totalReleased += inv.grandTotal || 0;
//       } else {
//         d.totalPending  += inv.grandTotal || 0;
//       }
//     });

//     const result = Object.values(dayMap)
//       .map(d => ({
//         ...d,
//         totalBulkOrders: d.bulkOrderCount.size,
//         totalAmount:    Math.round(d.totalAmount   * 100) / 100,
//         totalPending:   Math.round(d.totalPending  * 100) / 100,
//         totalReleased:  Math.round(d.totalReleased * 100) / 100,
//         isOverdue:      d.daysLeft < 0,
//         isUrgent:       d.daysLeft >= 0 && d.daysLeft <= 7,
//         fullyPaid:      Math.round(d.totalPending * 100) / 100 === 0,
//         bulkOrderCount: undefined, // Set remove karo
//       }))
//       .sort((a, b) => b.date.localeCompare(a.date));

//     // Overall summary
//     const overall = {
//       totalPending:  Math.round(result.reduce((s, r) => s + r.totalPending,  0) * 100) / 100,
//       totalReleased: Math.round(result.reduce((s, r) => s + r.totalReleased, 0) * 100) / 100,
//       totalAmount:   Math.round(result.reduce((s, r) => s + r.totalAmount,   0) * 100) / 100,
//       overdueDays:   result.filter(r => r.isOverdue && !r.fullyPaid).length,
//       urgentDays:    result.filter(r => r.isUrgent  && !r.fullyPaid).length,
//     };

//     res.json({ success: true, overall, total: result.length, data: result });
//   } catch (err) {
//     console.error("getPaymentDays error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  ADMIN — Bulk Orders for a specific date
// //  GET /api/admin/supplier-payments/days/:date/bulk-orders
// //  Returns: all bulk orders for that date with supplier breakdown
// // ═══════════════════════════════════════════════════════
// exports.getDayBulkOrders = async (req, res) => {
//   try {
//     const { date } = req.params; // "2026-06-15"
//     const PAYMENT_DAYS = await getPaymentDays(); // ← DB se fetch

//     const start = new Date(date); start.setHours(0, 0, 0, 0);
//     const end   = new Date(date); end.setHours(23, 59, 59, 999);

//     const invoices = await Invoice.find({
//       invoiceType: "supplier",
//       createdAt:   { $gte: start, $lte: end },
//     })
//       .populate("supplierBranchId", "managerName companyName phone email bankDetails")
//       .populate("bulkOrderId",      "totalQuantity winningPrice status readyAt")
//       .populate("platformItemId",   "name unit image")
//       .populate("countryId",        "name")
//       .populate("buyerBranchId",    "managerName companyName")
//       .lean();

//     // Group by bulkOrderId
//     const bulkMap = {};

//     invoices.forEach(inv => {
//       const bulkId = inv.bulkOrderId?._id?.toString() || "unknown";

//       if (!bulkMap[bulkId]) {
//         bulkMap[bulkId] = {
//           bulkOrderId:    bulkId,
//           orderRef:       `#ORD-${bulkId.slice(-6).toUpperCase()}`,
//           item:           inv.platformItemId?.name,
//           image:          inv.platformItemId?.image,
//           unit:           inv.platformItemId?.unit,
//           country:        inv.countryId?.name,
//           totalQuantity:  inv.bulkOrderId?.totalQuantity,
//           winningPrice:   inv.bulkOrderId?.winningPrice,
//           bulkStatus:     inv.bulkOrderId?.status,
//           readyAt:        inv.bulkOrderId?.readyAt,

//           // supplier info (same for all invoices in this bulk)
//           supplierName:    inv.supplierBranchId?.managerName,
//           supplierCompany: inv.supplierBranchId?.companyName,
//           supplierPhone:   inv.supplierBranchId?.phone,
//           supplierEmail:   inv.supplierBranchId?.email,
//           supplierBank:    inv.supplierBranchId?.bankDetails || null,
//           supplierBranchId: inv.supplierBranchId?._id,

//           buyerOrders: [],
//           totalAmount:   0,
//           totalPending:  0,
//           totalReleased: 0,
//           fullyPaid:     false,
//         };
//       }

//       const b = bulkMap[bulkId];
//       const released = inv.supplierPaymentStatus === "released";

//       b.buyerOrders.push({
//         invoiceId:     inv._id,
//         invoiceNumber: inv.invoiceNumber,
//         buyerName:     inv.buyerBranchId?.managerName,
//         buyerCompany:  inv.buyerBranchId?.companyName,
//         quantity:      inv.quantity,
//         pricePerUnit:  inv.pricePerUnit,
//         amount:        Math.round(inv.grandTotal * 100) / 100,
//         status:        inv.supplierPaymentStatus,
//         paidAt:        inv.supplierPaidAt || null,
//       });

//       b.totalAmount   += inv.grandTotal || 0;
//       if (released) b.totalReleased += inv.grandTotal || 0;
//       else          b.totalPending  += inv.grandTotal || 0;
//     });

//     const result = Object.values(bulkMap).map(b => ({
//       ...b,
//       totalAmount:   Math.round(b.totalAmount   * 100) / 100,
//       totalPending:  Math.round(b.totalPending  * 100) / 100,
//       totalReleased: Math.round(b.totalReleased * 100) / 100,
//       fullyPaid:     Math.round(b.totalPending  * 100) / 100 === 0,
//       buyerCount:    b.buyerOrders.length,
//     }));

//     // Day totals
//     const dayTotal = {
//       totalAmount:   Math.round(result.reduce((s, r) => s + r.totalAmount,   0) * 100) / 100,
//       totalPending:  Math.round(result.reduce((s, r) => s + r.totalPending,  0) * 100) / 100,
//       totalReleased: Math.round(result.reduce((s, r) => s + r.totalReleased, 0) * 100) / 100,
//       bulkOrderCount: result.length,
//       deadline:      new Date(new Date(date).getTime() + PAYMENT_DAYS * DAY_MS).toISOString().slice(0, 10),
//       daysLeft:      Math.ceil((new Date(date).getTime() + PAYMENT_DAYS * DAY_MS - Date.now()) / DAY_MS),
//     };

//     res.json({ success: true, date, dayTotal, total: result.length, data: result });
//   } catch (err) {
//     console.error("getDayBulkOrders error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  ADMIN — Pay Supplier (single bulk order OR all bulk orders of a day)
// //  POST /api/admin/supplier-payments/pay
// //  Body: { bulkOrderId } OR { date }  (ek dono me se)
// //  + { note, transactionRef }
// // ═══════════════════════════════════════════════════════
// exports.paySupplier = async (req, res) => {
//   try {
//     const { bulkOrderId, date, note, transactionRef } = req.body;

//     if (!bulkOrderId && !date) {
//       return res.status(400).json({ success: false, message: "bulkOrderId or date required" });
//     }

//     let filter = { invoiceType: "supplier", supplierPaymentStatus: "pending" };

//     if (bulkOrderId) {
//       // Single bulk order ka payment
//       const bulk = await BulkOrder.findById(bulkOrderId);
//       if (!bulk) {
//         return res.status(404).json({ success: false, message: "Bulk order not found" });
//       }
//       // Find all supplier invoices for this bulk
//       const invoiceIds = await Invoice.find({
//         bulkOrderId,
//         invoiceType: "supplier",
//         supplierPaymentStatus: "pending",
//       }).select("_id");

//       filter = { _id: { $in: invoiceIds.map(i => i._id) } };
//     } else {
//       // All bulk orders of a day
//       const start = new Date(date); start.setHours(0, 0, 0, 0);
//       const end   = new Date(date); end.setHours(23, 59, 59, 999);
//       filter.createdAt = { $gte: start, $lte: end };
//     }

//     const invoices = await Invoice.find(filter);

//     if (invoices.length === 0) {
//       return res.status(400).json({ success: false, message: "No pending supplier invoices found" });
//     }

//     const now = new Date();
//     let totalPaid = 0;

//     await Promise.all(invoices.map(async inv => {
//       await Invoice.findByIdAndUpdate(inv._id, {
//         supplierPaymentStatus: "released",
//         supplierPaidAt:        now,
//         amountDue:             0,
//         amountPaid:            inv.grandTotal,
//       });
//       totalPaid += inv.grandTotal;
//     }));

//     res.json({
//       success: true,
//       message: `✅ Payment released to ${invoices.length} supplier invoice(s).`,
//       data: {
//         invoiceCount:   invoices.length,
//         totalPaid:      Math.round(totalPaid * 100) / 100,
//         paidAt:         now,
//         note:           note || null,
//         transactionRef: transactionRef || null,
//       },
//     });
//   } catch (err) {
//     console.error("paySupplier error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  ADMIN — Supplier Payment Records (per supplier)
// //  GET /api/admin/supplier-payments/suppliers
// // ═══════════════════════════════════════════════════════
// exports.getSupplierPaymentRecords = async (req, res) => {
//   try {
//     const summary = await Invoice.aggregate([
//       { $match: { invoiceType: "supplier" } },
//       {
//         $group: {
//           _id:           "$supplierBranchId",
//           totalEarned:   { $sum: "$grandTotal" },
//           totalReleased: { $sum: { $cond: [{ $eq: ["$supplierPaymentStatus", "released"] }, "$grandTotal", 0] } },
//           totalPending:  { $sum: { $cond: [{ $ne: ["$supplierPaymentStatus", "released"] }, "$grandTotal", 0] } },
//           invoiceCount:  { $sum: 1 },
//           pendingCount:  { $sum: { $cond: [{ $ne: ["$supplierPaymentStatus", "released"] }, 1, 0] } },
//           lastActivity:  { $max: "$createdAt" },
//         },
//       },
//       {
//         $lookup: {
//           from:         "branches",
//           localField:   "_id",
//           foreignField: "_id",
//           as:           "branch",
//         },
//       },
//       { $unwind: { path: "$branch", preserveNullAndEmpty: true } },
//       {
//         $project: {
//           branchId:     "$_id",
//           supplierName: "$branch.managerName",
//           companyName:  "$branch.companyName",
//           email:        "$branch.email",
//           phone:        "$branch.phone",
//           bankDetails:  "$branch.bankDetails",
//           totalEarned:   { $round: ["$totalEarned",   2] },
//           totalReleased: { $round: ["$totalReleased", 2] },
//           totalPending:  { $round: ["$totalPending",  2] },
//           invoiceCount: 1,
//           pendingCount: 1,
//           lastActivity: 1,
//         },
//       },
//       { $sort: { totalPending: -1 } },
//     ]);

//     res.json({ success: true, total: summary.length, data: summary });
//   } catch (err) {
//     console.error("getSupplierPaymentRecords error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };



// // 📁 controllers/admin/adminSupplierPayment.js
// const Invoice     = require("../../models/invoice");
// const BulkOrder   = require("../../models/BulkOrder");
// const Branch      = require("../../models/Branch");

// const DAY_MS      = 24 * 60 * 60 * 1000;
// const PAYMENT_DAYS = 60; // payment deadline


// exports.getPaymentDays = async (req, res) => {
//   try {
//     // All supplier invoices — pending or released
//     const invoices = await Invoice.find({ invoiceType: "supplier" })
//       .populate("supplierBranchId", "managerName companyName")
//       .populate("bulkOrderId",      "status totalQuantity winningPrice readyAt")
//       .populate("platformItemId",   "name unit image")
//       .populate("countryId",        "name")
//       .lean();

//     // Group by date (createdAt date of invoice = day bidding was won)
//     const dayMap = {};

//     invoices.forEach(inv => {
//       const dateKey = new Date(inv.createdAt).toISOString().slice(0, 10);

//       if (!dayMap[dateKey]) {
//         dayMap[dateKey] = {
//           date:           dateKey,
//           dateLabel:      new Date(dateKey).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
//           deadline:       new Date(new Date(dateKey).getTime() + PAYMENT_DAYS * DAY_MS).toISOString().slice(0, 10),
//           daysLeft:       Math.ceil((new Date(dateKey).getTime() + PAYMENT_DAYS * DAY_MS - Date.now()) / DAY_MS),
//           totalBulkOrders: 0,
//           totalPending:   0,
//           totalReleased:  0,
//           totalAmount:    0,
//           bulkOrderCount: new Set(),
//         };
//       }

//       const d = dayMap[dateKey];
//       d.bulkOrderCount.add(inv.bulkOrderId?._id?.toString());
//       d.totalAmount   += inv.grandTotal || 0;

//       if (inv.supplierPaymentStatus === "released") {
//         d.totalReleased += inv.grandTotal || 0;
//       } else {
//         d.totalPending  += inv.grandTotal || 0;
//       }
//     });

//     const result = Object.values(dayMap)
//       .map(d => ({
//         ...d,
//         totalBulkOrders: d.bulkOrderCount.size,
//         totalAmount:    Math.round(d.totalAmount   * 100) / 100,
//         totalPending:   Math.round(d.totalPending  * 100) / 100,
//         totalReleased:  Math.round(d.totalReleased * 100) / 100,
//         isOverdue:      d.daysLeft < 0,
//         isUrgent:       d.daysLeft >= 0 && d.daysLeft <= 7,
//         fullyPaid:      Math.round(d.totalPending * 100) / 100 === 0,
//         bulkOrderCount: undefined, // Set remove karo
//       }))
//       .sort((a, b) => b.date.localeCompare(a.date));

//     // Overall summary
//     const overall = {
//       totalPending:  Math.round(result.reduce((s, r) => s + r.totalPending,  0) * 100) / 100,
//       totalReleased: Math.round(result.reduce((s, r) => s + r.totalReleased, 0) * 100) / 100,
//       totalAmount:   Math.round(result.reduce((s, r) => s + r.totalAmount,   0) * 100) / 100,
//       overdueDays:   result.filter(r => r.isOverdue && !r.fullyPaid).length,
//       urgentDays:    result.filter(r => r.isUrgent  && !r.fullyPaid).length,
//     };

//     res.json({ success: true, overall, total: result.length, data: result });
//   } catch (err) {
//     console.error("getPaymentDays error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  ADMIN — Bulk Orders for a specific date
// //  GET /api/admin/supplier-payments/days/:date/bulk-orders
// //  Returns: all bulk orders for that date with supplier breakdown
// // ═══════════════════════════════════════════════════════
// exports.getDayBulkOrders = async (req, res) => {
//   try {
//     const { date } = req.params; // "2026-06-15"

//     const start = new Date(date); start.setHours(0, 0, 0, 0);
//     const end   = new Date(date); end.setHours(23, 59, 59, 999);

//     const invoices = await Invoice.find({
//       invoiceType: "supplier",
//       createdAt:   { $gte: start, $lte: end },
//     })
//       .populate("supplierBranchId", "managerName companyName phone email bankDetails")
//       .populate("bulkOrderId",      "totalQuantity winningPrice status readyAt")
//       .populate("platformItemId",   "name unit image")
//       .populate("countryId",        "name")
//       .populate("buyerBranchId",    "managerName companyName")
//       .lean();

//     // Group by bulkOrderId
//     const bulkMap = {};

//     invoices.forEach(inv => {
//       const bulkId = inv.bulkOrderId?._id?.toString() || "unknown";

//       if (!bulkMap[bulkId]) {
//         bulkMap[bulkId] = {
//           bulkOrderId:    bulkId,
//           orderRef:       `#ORD-${bulkId.slice(-6).toUpperCase()}`,
//           item:           inv.platformItemId?.name,
//           image:          inv.platformItemId?.image,
//           unit:           inv.platformItemId?.unit,
//           country:        inv.countryId?.name,
//           totalQuantity:  inv.bulkOrderId?.totalQuantity,
//           winningPrice:   inv.bulkOrderId?.winningPrice,
//           bulkStatus:     inv.bulkOrderId?.status,
//           readyAt:        inv.bulkOrderId?.readyAt,

//           // supplier info (same for all invoices in this bulk)
//           supplierName:    inv.supplierBranchId?.managerName,
//           supplierCompany: inv.supplierBranchId?.companyName,
//           supplierPhone:   inv.supplierBranchId?.phone,
//           supplierEmail:   inv.supplierBranchId?.email,
//           supplierBank:    inv.supplierBranchId?.bankDetails || null,
//           supplierBranchId: inv.supplierBranchId?._id,

//           buyerOrders: [],
//           totalAmount:   0,
//           totalPending:  0,
//           totalReleased: 0,
//           fullyPaid:     false,
//         };
//       }

//       const b = bulkMap[bulkId];
//       const released = inv.supplierPaymentStatus === "released";

//       b.buyerOrders.push({
//         invoiceId:     inv._id,
//         invoiceNumber: inv.invoiceNumber,
//         buyerName:     inv.buyerBranchId?.managerName,
//         buyerCompany:  inv.buyerBranchId?.companyName,
//         quantity:      inv.quantity,
//         pricePerUnit:  inv.pricePerUnit,
//         amount:        Math.round(inv.grandTotal * 100) / 100,
//         status:        inv.supplierPaymentStatus,
//         paidAt:        inv.supplierPaidAt || null,
//       });

//       b.totalAmount   += inv.grandTotal || 0;
//       if (released) b.totalReleased += inv.grandTotal || 0;
//       else          b.totalPending  += inv.grandTotal || 0;
//     });

//     const result = Object.values(bulkMap).map(b => ({
//       ...b,
//       totalAmount:   Math.round(b.totalAmount   * 100) / 100,
//       totalPending:  Math.round(b.totalPending  * 100) / 100,
//       totalReleased: Math.round(b.totalReleased * 100) / 100,
//       fullyPaid:     Math.round(b.totalPending  * 100) / 100 === 0,
//       buyerCount:    b.buyerOrders.length,
//     }));

//     // Day totals
//     const dayTotal = {
//       totalAmount:   Math.round(result.reduce((s, r) => s + r.totalAmount,   0) * 100) / 100,
//       totalPending:  Math.round(result.reduce((s, r) => s + r.totalPending,  0) * 100) / 100,
//       totalReleased: Math.round(result.reduce((s, r) => s + r.totalReleased, 0) * 100) / 100,
//       bulkOrderCount: result.length,
//       deadline:      new Date(new Date(date).getTime() + PAYMENT_DAYS * DAY_MS).toISOString().slice(0, 10),
//       daysLeft:      Math.ceil((new Date(date).getTime() + PAYMENT_DAYS * DAY_MS - Date.now()) / DAY_MS),
//     };

//     res.json({ success: true, date, dayTotal, total: result.length, data: result });
//   } catch (err) {
//     console.error("getDayBulkOrders error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  ADMIN — Pay Supplier (single bulk order OR all bulk orders of a day)
// //  POST /api/admin/supplier-payments/pay
// //  Body: { bulkOrderId } OR { date }  (ek dono me se)
// //  + { note, transactionRef }
// // ═══════════════════════════════════════════════════════
// exports.paySupplier = async (req, res) => {
//   try {
//     const { bulkOrderId, date, note, transactionRef } = req.body;

//     if (!bulkOrderId && !date) {
//       return res.status(400).json({ success: false, message: "bulkOrderId or date required" });
//     }

//     let filter = { invoiceType: "supplier", supplierPaymentStatus: "pending" };

//     if (bulkOrderId) {
//       // Single bulk order ka payment
//       const bulk = await BulkOrder.findById(bulkOrderId);
//       if (!bulk) {
//         return res.status(404).json({ success: false, message: "Bulk order not found" });
//       }
//       // Find all supplier invoices for this bulk
//       const invoiceIds = await Invoice.find({
//         bulkOrderId,
//         invoiceType: "supplier",
//         supplierPaymentStatus: "pending",
//       }).select("_id");

//       filter = { _id: { $in: invoiceIds.map(i => i._id) } };
//     } else {
//       // All bulk orders of a day
//       const start = new Date(date); start.setHours(0, 0, 0, 0);
//       const end   = new Date(date); end.setHours(23, 59, 59, 999);
//       filter.createdAt = { $gte: start, $lte: end };
//     }

//     const invoices = await Invoice.find(filter);

//     if (invoices.length === 0) {
//       return res.status(400).json({ success: false, message: "No pending supplier invoices found" });
//     }

//     const now = new Date();
//     let totalPaid = 0;

//     await Promise.all(invoices.map(async inv => {
//       await Invoice.findByIdAndUpdate(inv._id, {
//         supplierPaymentStatus: "released",
//         supplierPaidAt:        now,
//         amountDue:             0,
//         amountPaid:            inv.grandTotal,
//       });
//       totalPaid += inv.grandTotal;
//     }));

//     res.json({
//       success: true,
//       message: `✅ Payment released to ${invoices.length} supplier invoice(s).`,
//       data: {
//         invoiceCount:   invoices.length,
//         totalPaid:      Math.round(totalPaid * 100) / 100,
//         paidAt:         now,
//         note:           note || null,
//         transactionRef: transactionRef || null,
//       },
//     });
//   } catch (err) {
//     console.error("paySupplier error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  ADMIN — Supplier Payment Records (per supplier)
// //  GET /api/admin/supplier-payments/suppliers
// // ═══════════════════════════════════════════════════════
// exports.getSupplierPaymentRecords = async (req, res) => {
//   try {
//     const summary = await Invoice.aggregate([
//       { $match: { invoiceType: "supplier" } },
//       {
//         $group: {
//           _id:           "$supplierBranchId",
//           totalEarned:   { $sum: "$grandTotal" },
//           totalReleased: { $sum: { $cond: [{ $eq: ["$supplierPaymentStatus", "released"] }, "$grandTotal", 0] } },
//           totalPending:  { $sum: { $cond: [{ $ne: ["$supplierPaymentStatus", "released"] }, "$grandTotal", 0] } },
//           invoiceCount:  { $sum: 1 },
//           pendingCount:  { $sum: { $cond: [{ $ne: ["$supplierPaymentStatus", "released"] }, 1, 0] } },
//           lastActivity:  { $max: "$createdAt" },
//         },
//       },
//       {
//         $lookup: {
//           from:         "branches",
//           localField:   "_id",
//           foreignField: "_id",
//           as:           "branch",
//         },
//       },
//       { $unwind: { path: "$branch", preserveNullAndEmpty: true } },
//       {
//         $project: {
//           branchId:     "$_id",
//           supplierName: "$branch.managerName",
//           companyName:  "$branch.companyName",
//           email:        "$branch.email",
//           phone:        "$branch.phone",
//           bankDetails:  "$branch.bankDetails",
//           totalEarned:   { $round: ["$totalEarned",   2] },
//           totalReleased: { $round: ["$totalReleased", 2] },
//           totalPending:  { $round: ["$totalPending",  2] },
//           invoiceCount: 1,
//           pendingCount: 1,
//           lastActivity: 1,
//         },
//       },
//       { $sort: { totalPending: -1 } },
//     ]);

//     res.json({ success: true, total: summary.length, data: summary });
//   } catch (err) {
//     console.error("getSupplierPaymentRecords error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// 📁 controllers/admin/adminSupplierPayment.js
const Invoice     = require("../../models/invoice");
const BulkOrder   = require("../../models/BulkOrder");
const Branch      = require("../../models/Branch");
const { getCommissionSettings } = require("../../cron/commissionSettingService");

const DAY_MS = 24 * 60 * 60 * 1000;

// Helper — DB se payment days lao (cache nahi — fresh fetch)
const getPaymentDays = async () => {
  const s = await getCommissionSettings();
  return s.supplierPaymentDays || 60;
};


exports.getPaymentDays = async (req, res) => {
  try {
    const PAYMENT_DAYS = await getPaymentDays(); // ← DB se fetch
    // All supplier invoices — pending or released
    const invoices = await Invoice.find({ invoiceType: "supplier" })
      .populate("supplierBranchId", "managerName companyName")
      .populate("bulkOrderId",      "status totalQuantity winningPrice readyAt")
      .populate("platformItemId",   "name unit image")
      .populate("countryId",        "name")
      .lean();

    // Group by date (createdAt date of invoice = day bidding was won)
    const dayMap = {};

    invoices.forEach(inv => {
      const dateKey = new Date(inv.createdAt).toISOString().slice(0, 10);

      if (!dayMap[dateKey]) {
        dayMap[dateKey] = {
          date:           dateKey,
          dateLabel:      new Date(dateKey).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          deadline:       new Date(new Date(dateKey).getTime() + PAYMENT_DAYS * DAY_MS).toISOString().slice(0, 10),
          daysLeft:       Math.ceil((new Date(dateKey).getTime() + PAYMENT_DAYS * DAY_MS - Date.now()) / DAY_MS),
          totalBulkOrders: 0,
          totalPending:   0,
          totalReleased:  0,
          totalAmount:    0,
          bulkOrderCount: new Set(),
        };
      }

      const d = dayMap[dateKey];
      d.bulkOrderCount.add(inv.bulkOrderId?._id?.toString());
      d.totalAmount   += inv.grandTotal || 0;

      if (inv.supplierPaymentStatus === "released") {
        d.totalReleased += inv.grandTotal || 0;
      } else {
        d.totalPending  += inv.grandTotal || 0;
      }
    });

    const result = Object.values(dayMap)
      .map(d => ({
        ...d,
        totalBulkOrders: d.bulkOrderCount.size,
        totalAmount:    Math.round(d.totalAmount   * 100) / 100,
        totalPending:   Math.round(d.totalPending  * 100) / 100,
        totalReleased:  Math.round(d.totalReleased * 100) / 100,
        isOverdue:      d.daysLeft < 0,
        isUrgent:       d.daysLeft >= 0 && d.daysLeft <= 7,
        fullyPaid:      Math.round(d.totalPending * 100) / 100 === 0,
        bulkOrderCount: undefined, // Set remove karo
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Overall summary
    const overall = {
      totalPending:  Math.round(result.reduce((s, r) => s + r.totalPending,  0) * 100) / 100,
      totalReleased: Math.round(result.reduce((s, r) => s + r.totalReleased, 0) * 100) / 100,
      totalAmount:   Math.round(result.reduce((s, r) => s + r.totalAmount,   0) * 100) / 100,
      overdueDays:   result.filter(r => r.isOverdue && !r.fullyPaid).length,
      urgentDays:    result.filter(r => r.isUrgent  && !r.fullyPaid).length,
    };

    res.json({ success: true, overall, total: result.length, data: result });
  } catch (err) {
    console.error("getPaymentDays error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Bulk Orders for a specific date
//  GET /api/admin/supplier-payments/days/:date/bulk-orders
//  Returns: all bulk orders for that date with supplier breakdown
// ═══════════════════════════════════════════════════════
exports.getDayBulkOrders = async (req, res) => {
  try {
    const { date } = req.params; // "2026-06-15"
    const PAYMENT_DAYS = await getPaymentDays(); // ← DB se fetch

    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);

    const invoices = await Invoice.find({
      invoiceType: "supplier",
      createdAt:   { $gte: start, $lte: end },
    })
      .populate("supplierBranchId", "managerName companyName phone email bankDetails")
      .populate("bulkOrderId",      "totalQuantity winningPrice status readyAt")
      .populate("platformItemId",   "name unit image")
      .populate("countryId",        "name")
      .populate("buyerBranchId",    "managerName companyName")
      .populate("buyerOrderId",     "status")
      .lean();

    // Group by bulkOrderId
    const bulkMap = {};

    invoices.forEach(inv => {
      const bulkId = inv.bulkOrderId?._id?.toString() || "unknown";

      if (!bulkMap[bulkId]) {
        bulkMap[bulkId] = {
          bulkOrderId:    bulkId,
          orderRef:       `#ORD-${bulkId.slice(-6).toUpperCase()}`,
          item:           inv.platformItemId?.name,
          image:          inv.platformItemId?.image,
          unit:           inv.platformItemId?.unit,
          country:        inv.countryId?.name,
          totalQuantity:  inv.bulkOrderId?.totalQuantity,
          winningPrice:   inv.bulkOrderId?.winningPrice,
          bulkStatus:     inv.bulkOrderId?.status,
          readyAt:        inv.bulkOrderId?.readyAt,

          // supplier info (same for all invoices in this bulk)
          supplierName:    inv.supplierBranchId?.managerName,
          supplierCompany: inv.supplierBranchId?.companyName,
          supplierPhone:   inv.supplierBranchId?.phone,
          supplierEmail:   inv.supplierBranchId?.email,
          supplierBank:    inv.supplierBranchId?.bankDetails || null,
          supplierBranchId: inv.supplierBranchId?._id,

          buyerOrders: [],
          totalAmount:     0,
          totalPending:    0,
          totalReleased:   0,
          totalDeduction:  0,
          fullyPaid:       false,
        };
      }

      const b = bulkMap[bulkId];
      const released = inv.supplierPaymentStatus === "released";

      b.buyerOrders.push({
        invoiceId:          inv._id,
        invoiceNumber:      inv.invoiceNumber,
        buyerName:          inv.buyerBranchId?.managerName,
        buyerCompany:       inv.buyerBranchId?.companyName,
        quantity:           inv.quantity,
        pricePerUnit:       inv.pricePerUnit,
        amount:             Math.round(inv.grandTotal * 100) / 100,
        deduction:          Math.round((inv.supplierDeduction || 0) * 100) / 100,
        netAmount:          Math.round(((inv.grandTotal || 0) - (inv.supplierDeduction || 0)) * 100) / 100,
        orderStatus:        inv.buyerOrderId?.status || null,
        status:             inv.supplierPaymentStatus,
        paidAt:             inv.supplierPaidAt || null,
      });

      b.totalAmount     += inv.grandTotal || 0;
      b.totalDeduction  += inv.supplierDeduction || 0;
      if (released) b.totalReleased += inv.grandTotal || 0;
      else          b.totalPending  += inv.grandTotal || 0;
    });

    const result = Object.values(bulkMap).map(b => ({
      ...b,
      totalAmount:       Math.round(b.totalAmount      * 100) / 100,
      totalPending:      Math.round(b.totalPending     * 100) / 100,
      totalReleased:     Math.round(b.totalReleased    * 100) / 100,
      totalDeduction:    Math.round(b.totalDeduction   * 100) / 100,
      netToPaySupplier:  Math.round((b.totalAmount - b.totalDeduction) * 100) / 100,
      fullyPaid:         Math.round(b.totalPending     * 100) / 100 === 0,
      buyerCount:        b.buyerOrders.length,
    }));

    // Day totals
    const dayTotal = {
      totalAmount:   Math.round(result.reduce((s, r) => s + r.totalAmount,   0) * 100) / 100,
      totalPending:  Math.round(result.reduce((s, r) => s + r.totalPending,  0) * 100) / 100,
      totalReleased: Math.round(result.reduce((s, r) => s + r.totalReleased, 0) * 100) / 100,
      bulkOrderCount: result.length,
      deadline:      new Date(new Date(date).getTime() + PAYMENT_DAYS * DAY_MS).toISOString().slice(0, 10),
      daysLeft:      Math.ceil((new Date(date).getTime() + PAYMENT_DAYS * DAY_MS - Date.now()) / DAY_MS),
    };

    res.json({ success: true, date, dayTotal, total: result.length, data: result });
  } catch (err) {
    console.error("getDayBulkOrders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Pay Supplier (single bulk order OR all bulk orders of a day)
//  POST /api/admin/supplier-payments/pay
//  Body: { bulkOrderId } OR { date }  (ek dono me se)
//  + { note, transactionRef }
// ═══════════════════════════════════════════════════════
exports.paySupplier = async (req, res) => {
  try {
    const { bulkOrderId, date, note, transactionRef } = req.body;

    if (!bulkOrderId && !date) {
      return res.status(400).json({ success: false, message: "bulkOrderId or date required" });
    }

    let filter = { invoiceType: "supplier", supplierPaymentStatus: "pending" };

    if (bulkOrderId) {
      // Single bulk order ka payment
      const bulk = await BulkOrder.findById(bulkOrderId);
      if (!bulk) {
        return res.status(404).json({ success: false, message: "Bulk order not found" });
      }
      // Find all supplier invoices for this bulk
      const invoiceIds = await Invoice.find({
        bulkOrderId,
        invoiceType: "supplier",
        supplierPaymentStatus: "pending",
      }).select("_id");

      filter = { _id: { $in: invoiceIds.map(i => i._id) } };
    } else {
      // All bulk orders of a day
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end   = new Date(date); end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }

    const invoices = await Invoice.find(filter);

    if (invoices.length === 0) {
      return res.status(400).json({ success: false, message: "No pending supplier invoices found" });
    }

    const now = new Date();
    let totalPaid = 0;

    await Promise.all(invoices.map(async inv => {
      await Invoice.findByIdAndUpdate(inv._id, {
        supplierPaymentStatus: "released",
        supplierPaidAt:        now,
        amountDue:             0,
        amountPaid:            inv.grandTotal,
      });
      totalPaid += inv.grandTotal;
    }));

    res.json({
      success: true,
      message: `✅ Payment released to ${invoices.length} supplier invoice(s).`,
      data: {
        invoiceCount:   invoices.length,
        totalPaid:      Math.round(totalPaid * 100) / 100,
        paidAt:         now,
        note:           note || null,
        transactionRef: transactionRef || null,
      },
    });
  } catch (err) {
    console.error("paySupplier error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Supplier Payment Records (per supplier)
//  GET /api/admin/supplier-payments/suppliers
// ═══════════════════════════════════════════════════════
exports.getSupplierPaymentRecords = async (req, res) => {
  try {
    const summary = await Invoice.aggregate([
      { $match: { invoiceType: "supplier" } },
      {
        $group: {
          _id:           "$supplierBranchId",
          totalEarned:   { $sum: "$grandTotal" },
          totalReleased: { $sum: { $cond: [{ $eq: ["$supplierPaymentStatus", "released"] }, "$grandTotal", 0] } },
          totalPending:  { $sum: { $cond: [{ $ne: ["$supplierPaymentStatus", "released"] }, "$grandTotal", 0] } },
          invoiceCount:  { $sum: 1 },
          pendingCount:  { $sum: { $cond: [{ $ne: ["$supplierPaymentStatus", "released"] }, 1, 0] } },
          lastActivity:  { $max: "$createdAt" },
        },
      },
      {
        $lookup: {
          from:         "branches",
          localField:   "_id",
          foreignField: "_id",
          as:           "branch",
        },
      },
      { $unwind: { path: "$branch", preserveNullAndEmpty: true } },
      {
        $project: {
          branchId:     "$_id",
          supplierName: "$branch.managerName",
          companyName:  "$branch.companyName",
          email:        "$branch.email",
          phone:        "$branch.phone",
          bankDetails:  "$branch.bankDetails",
          totalEarned:   { $round: ["$totalEarned",   2] },
          totalReleased: { $round: ["$totalReleased", 2] },
          totalPending:  { $round: ["$totalPending",  2] },
          invoiceCount: 1,
          pendingCount: 1,
          lastActivity: 1,
        },
      },
      { $sort: { totalPending: -1 } },
    ]);

    res.json({ success: true, total: summary.length, data: summary });
  } catch (err) {
    console.error("getSupplierPaymentRecords error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};