// // 📁 controllers/buyer/buyerOrder.js
// const BuyerOrder   = require("../../models/buyer/buyerOrder");
// const PlatformItem = require("../../models/masterData/PlatformItem");
// const Country      = require("../../models/masterData/Country");
// const Invoice      = require("../../models/invoice");
// const Branch       = require("../../models/Branch");
// const BulkOrder    = require("../../models/BulkOrder");
// const Bid          = require("../../models/Bid");
// const SupplierItem = require("../../models/supplier/supplierCatalog");
// const mongoose     = require("mongoose");
// const { getBiddingSettings } = require("../../cron/settingService");
// const DeliveryOrder = require("../../models/riderCompany/orderDelivery");
// const ReturnOrder   = require("../../models/returnOrder/ReturnOrder");

// const CANCEL_CUTOFF_MIN = 2;

// // ─── Qatar time helpers (Qatar = UTC+3, cron ke saath bilkul consistent) ───
// const getQatarNowParts = () => {
//   const qatar = new Date(Date.now() + 3 * 60 * 60 * 1000);
//   return {
//     year:  qatar.getUTCFullYear(),
//     month: qatar.getUTCMonth(),
//     day:   qatar.getUTCDate(),
//     hour:  qatar.getUTCHours(),
//   };
// };

// // Qatar ki abhi ki hour (cutoff compare ke liye)
// const getQatarHour = () => getQatarNowParts().hour;

// // Qatar aaj ke din ka (hour:min) → asli UTC Date
// const getTodayBiddingStart = (settings) => {
//   const { year, month, day } = getQatarNowParts();
//   const utcMs = Date.UTC(year, month, day, settings.BIDDING_START_HOUR, settings.BIDDING_START_MIN, 0, 0) - 3 * 60 * 60 * 1000;
//   return new Date(utcMs);
// };

// const getTomorrowBiddingStart = (settings) => {
//   const { year, month, day } = getQatarNowParts();
//   const utcMs = Date.UTC(year, month, day + 1, settings.BIDDING_START_HOUR, settings.BIDDING_START_MIN, 0, 0) - 3 * 60 * 60 * 1000;
//   return new Date(utcMs);
// };

// const getUsedPDC = async (branchId) => {
//   const branchObjectId = new mongoose.Types.ObjectId(branchId);

//   const pendingOrders = await BuyerOrder.aggregate([
//     {
//       $match: {
//         buyerBranchId: branchObjectId,
//         status: { $in: ["pending", "in_bidding", "won", "packed", "ready_for_pickup"] },
//       },
//     },
//     { $group: { _id: null, total: { $sum: "$estimatedAmount" } } },
//   ]);

//   const unpaidInvoices = await Invoice.aggregate([
//     {
//       $match: {
//         buyerBranchId: branchObjectId,
//         invoiceType:   "buyer",
//         paymentStatus: { $in: ["unpaid", "partial", "overdue"] },
//       },
//     },
//     { $group: { _id: null, total: { $sum: "$amountDue" } } },
//   ]);

//   return (pendingOrders[0]?.total || 0) + (unpaidInvoices[0]?.total || 0);
// };

// // ─── Cancel ho sakta hai ya nahi (ek hi jagah rule) ───
// // pending     → bidding start se 2 min pehle tak (taaki bulk me shamil na ho)
// // in_bidding  → sirf jab WINDOW KHATAM ho gaya AUR koi bid nahi aayi (supplier nahi mila)
// //               live bidding ke beech / bid aane par → cancel BAND
// const computeCanCancel = ({ status, bidDate, biddingEndsAt, bidCount }) => {
//   const now = new Date();

//   if (status === "pending") {
//     if (!bidDate) return false;
//     const cutoff = new Date(new Date(bidDate).getTime() - CANCEL_CUTOFF_MIN * 60 * 1000);
//     return now < cutoff;
//   }

//   if (status === "in_bidding") {
//     const ended  = biddingEndsAt ? now >= new Date(biddingEndsAt) : false;
//     const noBids = (bidCount || 0) === 0;
//     return ended && noBids;
//   }

//   return false;
// };

// // ═══════════════════════════════════════════════════════
// //  BUYER — Place Order
// // ═══════════════════════════════════════════════════════
// exports.placeOrder = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Buyer") {
//       return res.status(403).json({ success: false, message: "Only buyers can place orders" });
//     }

//     const { platformItemId, countryId, quantity, deliveryAddress } = req.body;

//     if (!platformItemId || !countryId || !quantity) {
//       return res.status(400).json({
//         success: false,
//         message: "platformItemId, countryId, and quantity are required",
//       });
//     }

//     const buyerBranch = await Branch.findById(req.branch._id);
//     if (!buyerBranch.pdcAmount) {
//       return res.status(400).json({
//         success: false,
//         message: "Your PDC limit has not been set. Please contact the admin.",
//       });
//     }

//     const platformItem = await PlatformItem.findById(platformItemId);
//     if (!platformItem) {
//       return res.status(404).json({ success: false, message: "Item not found" });
//     }

//     const country = await Country.findById(countryId);
//     if (!country) {
//       return res.status(404).json({ success: false, message: "Country not found" });
//     }

//     const supplierItems = await SupplierItem.find({
//       platformItemId,
//       countryId,
//       isListed:         true,
//       isAvailableToday: true,
//     });

//     if (supplierItems.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No suppliers available for this item.",
//       });
//     }

//     const prices          = supplierItems.map((s) => s.pricePerUnit);
//     const minPrice        = Math.min(...prices);
//     const maxPrice        = Math.max(...prices);
//     const estimatedAmount = maxPrice * quantity;

//     const usedAmount      = await getUsedPDC(req.branch._id);
//     const remainingAmount = buyerBranch.pdcAmount - usedAmount;

//     if (remainingAmount <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Your PDC limit is fully utilized. Please clear your pending dues first.",
//         data: { pdcLimit: buyerBranch.pdcAmount, used: usedAmount, remaining: 0 },
//       });
//     }

//     if (estimatedAmount > remainingAmount) {
//       return res.status(400).json({
//         success: false,
//         message: `Insufficient PDC. Estimated: ${estimatedAmount} QAR | Remaining: ${remainingAmount} QAR`,
//         data: {
//           pdcLimit:            buyerBranch.pdcAmount,
//           used:                usedAmount,
//           remaining:           remainingAmount,
//           estimatedAmount,
//           maxQuantityCanOrder: Math.floor(remainingAmount / maxPrice),
//         },
//       });
//     }

//     const settings = await getBiddingSettings();
//     const CUTOFF   = settings.BIDDING_CUTOFF_HOUR;

//     const qatarHour = getQatarHour();

//     let bidDate, biddingMessage, biddingDateStr;

//     if (qatarHour < CUTOFF) {
//       bidDate        = getTodayBiddingStart(settings);
//       biddingDateStr = "Today";
//       biddingMessage = `Order added to today's bidding.`;
//     } else {
//       bidDate        = getTomorrowBiddingStart(settings);
//       biddingDateStr = "Tomorrow";
//       biddingMessage = `Order will be in tomorrow's bidding.`;
//     }

//     const finalDeliveryAddress = deliveryAddress || {
//       lat:     buyerBranch.address?.lat,
//       lng:     buyerBranch.address?.lng,
//       address: buyerBranch.address?.address,
//       area:    buyerBranch.address?.area,
//       city:    buyerBranch.address?.city,
//     };

//     const order = await BuyerOrder.create({
//       buyerBranchId:   req.branch._id,
//       buyerCompanyId:  req.branch.companyId,
//       platformItemId,
//       countryId,
//       quantity,
//       deliveryAddress: finalDeliveryAddress,
//       bidDate,
//       minPrice,
//       maxPrice,
//       estimatedAmount,
//     });

//     res.status(201).json({
//       success: true,
//       message: biddingMessage,
//       data: {
//         ...order.toObject(),
//         biddingDay: biddingDateStr,
//         pdcInfo: {
//           pdcLimit:        buyerBranch.pdcAmount,
//           used:            usedAmount + estimatedAmount,
//           remaining:       remainingAmount - estimatedAmount,
//           estimatedAmount,
//         },
//       },
//     });
//   } catch (err) {
//     console.error("placeOrder error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  BUYER — Get My Orders
// // ═══════════════════════════════════════════════════════
// exports.getMyOrders = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Buyer") {
//       return res.status(403).json({ success: false, message: "Only buyers can access this" });
//     }

//     const orders = await BuyerOrder.find({ buyerBranchId: req.branch._id })
//       .populate("platformItemId", "name image unit")
//       .populate("countryId", "name code")
//       .sort({ createdAt: -1 });

//     res.json({ success: true, total: orders.length, data: orders });
//   } catch (err) {
//     console.error("getMyOrders error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  BUYER — Single Order Bidding Status (live + won + saved + canCancel)
// //  GET /api/buyer/orders/:orderId/bidding-status
// // ═══════════════════════════════════════════════════════
// exports.getOrderBiddingStatus = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Buyer") {
//       return res.status(403).json({ success: false, message: "Only buyers can access this" });
//     }

//     const order = await BuyerOrder.findOne({
//       _id:           req.params.orderId,
//       buyerBranchId: req.branch._id,
//     })
//       .populate("platformItemId", "name image unit")
//       .populate("countryId", "name code");

//     if (!order) {
//       return res.status(404).json({ success: false, message: "Order not found" });
//     }

//     const qty      = order.quantity;
//     const minPrice = order.minPrice ?? null;
//     const maxPrice = order.maxPrice ?? null;

//     const blockedAmount = maxPrice ? Math.round(maxPrice * qty * 100) / 100 : null;

//     const bulk = order.bulkOrderId
//       ? await BulkOrder.findById(order.bulkOrderId).select(
//           "winningPrice biddingEndsAt status"
//         )
//       : null;

//     const base = {
//       orderId:       order._id,
//       itemName:      order.platformItemId?.name,
//       itemImage:     order.platformItemId?.image,
//       unit:          order.platformItemId?.unit,
//       country:       order.countryId?.name,
//       quantity:      qty,
//       minRate:       minPrice,
//       maxRate:       maxPrice,
//       minAmount:     minPrice ? Math.round(minPrice * qty * 100) / 100 : null,
//       maxAmount:     maxPrice ? Math.round(maxPrice * qty * 100) / 100 : null,
//       blockedAmount,
//       biddingEndsAt: bulk?.biddingEndsAt || order.bidDate,
//       bidDate:       order.bidDate,
//       status:        order.status,
//     };

//     // ─── WON phase ───────────────────────────────────────
//     const WON_STATUSES = ["won", "packed", "ready_for_pickup", "delivered", "return_requested", "returned"];
//     if (WON_STATUSES.includes(order.status) && bulk?.winningPrice != null) {
//       const PLATFORM_FEE = 0.03;

//       const baseRate    = bulk.winningPrice;
//       const wonRate     = Math.round(baseRate * (1 + PLATFORM_FEE) * 100) / 100;
//       const baseAmount  = Math.round(baseRate * qty * 100) / 100;
//       const finalAmount = Math.round(wonRate * qty * 100) / 100;
//       const feeAmount   = Math.round((finalAmount - baseAmount) * 100) / 100;
//       const saved       = blockedAmount != null
//         ? Math.round((blockedAmount - finalAmount) * 100) / 100
//         : 0;

//       // ─── Return order info ────────────────────────────
//       const returnOrder = await ReturnOrder.findOne({ buyerOrderId: order._id })
//         .select("status subject supplierNote adminNote createdAt")
//         .sort({ createdAt: -1 });

//       // ─── 24hr window check ────────────────────────────
//       let withinReturnWindow = false;
//       if (order.status === "delivered") {
//         const invoice = await Invoice.findOne({ buyerOrderId: order._id, invoiceType: "buyer" })
//           .select("deliveredAt");
//         if (invoice?.deliveredAt) {
//           const hours = (Date.now() - new Date(invoice.deliveredAt).getTime()) / (1000 * 60 * 60);
//           withinReturnWindow = hours <= 24;
//         }
//       }

//       return res.json({
//         success: true,
//         data: {
//           ...base,
//           phase:        "won",
//           wonRate,
//           baseRate,
//           finalAmount,
//           baseAmount,
//           feeAmount,
//           feePercent:   3,
//           saved,
//           savedPercent: blockedAmount ? Math.round((saved / blockedAmount) * 100) : 0,
//           canCancel:    false,
//           // ─── Return info ──────────────────────────────
//           withinReturnWindow,
//           returnRequest: returnOrder ? {
//             status:         returnOrder.status,
//             subject:        returnOrder.subject,
//             supplierNote:   returnOrder.supplierNote || null,
//             adminNote:      returnOrder.adminNote    || null,
//             submittedAt:    returnOrder.createdAt,
//           } : null,
//         },
//       });
//     }

//     // ─── PENDING + LIVE (in_bidding) ─────────────────────
//     let currentLowestRate = null;
//     let bidCount          = 0;
//     let supplierCount     = 0;
//     let windowEnded       = false;

//     if (order.status === "in_bidding" && order.bulkOrderId) {
//       const lowest = await Bid.findOne({
//         bulkOrderId:  order.bulkOrderId,
//         pricePerUnit: { $ne: null },
//       })
//         .sort({ pricePerUnit: 1 })
//         .select("pricePerUnit");

//       currentLowestRate = lowest?.pricePerUnit ?? null;

//       // sirf asli bids (ignored/missed nahi)
//       bidCount = await Bid.countDocuments({
//         bulkOrderId:  order.bulkOrderId,
//         pricePerUnit: { $ne: null },
//       });

//       supplierCount = await SupplierItem.countDocuments({
//         platformItemId:   order.platformItemId._id,
//         countryId:        order.countryId._id,
//         isListed:         true,
//         isAvailableToday: true,
//       });

//       if (bulk?.biddingEndsAt) {
//         windowEnded = new Date(bulk.biddingEndsAt) <= new Date();
//       }
//     } else if (order.status === "pending") {
//       supplierCount = await SupplierItem.countDocuments({
//         platformItemId:   order.platformItemId._id,
//         countryId:        order.countryId._id,
//         isListed:         true,
//         isAvailableToday: true,
//       });
//     }

//     const canCancel = computeCanCancel({
//       status:        order.status,
//       bidDate:       order.bidDate,
//       biddingEndsAt: bulk?.biddingEndsAt,
//       bidCount,
//     });

//     return res.json({
//       success: true,
//       data: {
//         ...base,
//         phase:               order.status === "pending" ? "pending" : "bidding",
//         currentLowestRate,
//         currentLowestAmount: currentLowestRate
//           ? Math.round(currentLowestRate * qty * 100) / 100
//           : null,
//         bidCount,
//         supplierCount,
//         noSupplier:  supplierCount === 0,
//         windowEnded,
//         canCancel,
//       },
//     });
//   } catch (err) {
//     console.error("getOrderBiddingStatus error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  BUYER — Cancel Order
// //  pending     → bidding start se 2 min pehle tak
// //  in_bidding  → sirf jab window khatam ho gaya AUR koi bid nahi aayi
// // ═══════════════════════════════════════════════════════
// exports.cancelOrder = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Buyer") {
//       return res.status(403).json({ success: false, message: "Only buyers can cancel orders" });
//     }

//     const order = await BuyerOrder.findOne({
//       _id:           req.params.orderId,
//       buyerBranchId: req.branch._id,
//     });

//     if (!order) {
//       return res.status(404).json({ success: false, message: "Order not found" });
//     }

//     if (order.status !== "pending" && order.status !== "in_bidding") {
//       return res.status(400).json({
//         success: false,
//         message: `Cannot cancel — status: ${order.status}`,
//       });
//     }

//     // Order pe abhi tak koi BID aayi ya nahi + window end time
//     let bidCount      = 0;
//     let biddingEndsAt = null;
//     if (order.status === "in_bidding" && order.bulkOrderId) {
//       bidCount = await Bid.countDocuments({
//         bulkOrderId:  order.bulkOrderId,
//         pricePerUnit: { $ne: null },
//       });
//       const bulk = await BulkOrder.findById(order.bulkOrderId).select("biddingEndsAt");
//       biddingEndsAt = bulk?.biddingEndsAt || null;
//     }

//     const allowed = computeCanCancel({
//       status:   order.status,
//       bidDate:  order.bidDate,
//       biddingEndsAt,
//       bidCount,
//     });

//     if (!allowed) {
//       let msg = `Cannot cancel — status: ${order.status}`;
//       if (order.status === "pending") {
//         msg = "Cannot cancel — bidding starts in less than 2 minutes";
//       } else if (order.status === "in_bidding") {
//         msg = bidCount > 0
//           ? "A bid has already been placed on your order — cannot cancel now."
//           : "Bidding is in progress — you can cancel only after it ends if no supplier is found.";
//       }
//       return res.status(400).json({ success: false, message: msg });
//     }

//     await BuyerOrder.findByIdAndUpdate(order._id, {
//       status:          "cancelled",
//       estimatedAmount: 0,
//     });

//     res.json({ success: true, message: "Order cancelled. PDC amount has been released." });
//   } catch (err) {
//     console.error("cancelOrder error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  BUYER — Return Request
// // ═══════════════════════════════════════════════════════
// exports.returnOrder = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Buyer") {
//       return res.status(403).json({ success: false, message: "Only buyers can request a return" });
//     }

//     const { reason } = req.body;
//     const validReasons = ["incorrect", "damaged", "rotten", "expired"];
//     if (!reason || !validReasons.includes(reason)) {
//       return res.status(400).json({
//         success: false,
//         message: "Return reason must be: incorrect, damaged, rotten, or expired",
//       });
//     }

//     const order = await BuyerOrder.findOne({
//       _id:           req.params.orderId,
//       buyerBranchId: req.branch._id,
//     });

//     if (!order) {
//       return res.status(404).json({ success: false, message: "Order not found" });
//     }

//     if (order.status !== "delivered") {
//       return res.status(400).json({
//         success: false,
//         message: "Only delivered orders can be returned",
//       });
//     }

//     const invoice = await Invoice.findOne({
//       buyerOrderId: order._id,
//       invoiceType:  "buyer",
//     });

//     if (!invoice || !invoice.deliveredAt) {
//       return res.status(400).json({ success: false, message: "Delivery info not found" });
//     }

//     const hoursPassed = (new Date() - new Date(invoice.deliveredAt)) / (1000 * 60 * 60);
//     if (hoursPassed > 24) {
//       return res.status(400).json({
//         success: false,
//         message: "Return window closed — only within 24 hours of delivery",
//       });
//     }

//     await BuyerOrder.findByIdAndUpdate(order._id, { status: "return_requested" });
//     await Invoice.findByIdAndUpdate(invoice._id, {
//       deliveryStatus: "returned",
//       returnReason:   reason,
//     });

//     res.json({
//       success: true,
//       message: "Return request submitted. PDC will be released after supplier approval.",
//     });
//   } catch (err) {
//     console.error("returnOrder error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  BUYER — Get My Invoices
// // ═══════════════════════════════════════════════════════
// exports.getMyInvoices = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Buyer") {
//       return res.status(403).json({ success: false, message: "Only buyers can access this" });
//     }

//     const invoices = await Invoice.find({
//       buyerBranchId: req.branch._id,
//       invoiceType:   "buyer",
//     })
//       .populate("platformItemId", "name image unit")
//       .populate("countryId", "name")
//       .sort({ createdAt: -1 });

//     res.json({ success: true, total: invoices.length, data: invoices });
//   } catch (err) {
//     console.error("getMyInvoices error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };





// // ═══════════════════════════════════════════════════════
// //  BUYER — Order Tracking (delivery progress)
// //  GET /api/buyer/orders/:orderId/tracking
// //  controllers/buyer/buyerOrder.js me ADD karo
// //
// // ═══════════════════════════════════════════════════════
// exports.getOrderTracking = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Buyer") {
//       return res.status(403).json({ success: false, message: "Only buyers can access this" });
//     }

//     const order = await BuyerOrder.findOne({
//       _id:           req.params.orderId,
//       buyerBranchId: req.branch._id,
//     })
//       .populate("platformItemId", "name image unit")
//       .populate("countryId", "name code");

//     if (!order) {
//       return res.status(404).json({ success: false, message: "Order not found" });
//     }

//     // Delivery order (agar bana ho — ready hone ke baad)
//     let delivery = null;
//     if (order.bulkOrderId) {
//       delivery = await DeliveryOrder.findOne({ bulkOrderId: order.bulkOrderId });
//     }

//     // Is buyer ka apna stop (delivery ke andar)
//     let myStop = null;
//     if (delivery) {
//       myStop = delivery.deliveries.find(
//         (d) => d.buyerOrderId.toString() === order._id.toString()
//       );
//     }

//     // ─── Timeline steps (5 step) ───
//     // 1 won/awarded → Supplier Preparing
//     // 2 packed      → Order Packed
//     // 3 picked      → Dispatched (rider uthaya)
//     // 4 out_for_delivery → In Transit
//     // 5 delivered   → Delivered

//     const steps = [
//       {
//         key:   "preparing",
//         title: "Supplier Preparing Order",
//         sub:   "Your order is confirmed and being prepared.",
//         done:  ["won", "packed", "ready_for_pickup", "delivered"].includes(order.status),
//         time:  order.status === "won" ? order.updatedAt : null,
//       },
//       {
//         key:   "packed",
//         title: "Order Packed",
//         sub:   "Your order has been packed and is ready for pickup.",
//         done:  ["packed", "ready_for_pickup", "delivered"].includes(order.status),
//         time:  delivery?.readyAt || null,
//       },
//       {
//         key:   "dispatched",
//         title: "Dispatched",
//         sub:   "Package has been picked up by the courier.",
//         done:  ["ready_for_pickup", "delivered"].includes(order.status) &&
//                !!delivery && ["picked", "out_for_delivery", "delivered"].includes(delivery.status),
//         time:  delivery?.pickedAt || null,
//       },
//       {
//         key:   "in_transit",
//         title: "In Transit",
//         sub:   "Package is on the way to your location.",
//         done:  !!delivery && ["out_for_delivery", "delivered"].includes(delivery.status),
//         time:  null,
//       },
//       {
//         key:   "delivered",
//         title: "Delivered",
//         sub:   "Package delivered to your address.",
//         done:  order.status === "delivered" || myStop?.status === "delivered",
//         time:  myStop?.deliveredAt || delivery?.deliveredAt || null,
//       },
//     ];

//     // current step index (last done)
//     let currentStep = 0;
//     steps.forEach((s, i) => { if (s.done) currentStep = i; });

//     // progress %
//     const progressPercent = Math.round((currentStep / (steps.length - 1)) * 100);

//     res.json({
//       success: true,
//       data: {
//         orderId:       order._id,
//         orderNumber:   `#ORD-${order._id.toString().slice(-6).toUpperCase()}`,
//         itemName:      order.platformItemId?.name,
//         itemImage:     order.platformItemId?.image,
//         unit:          order.platformItemId?.unit,
//         country:       order.countryId?.name,
//         quantity:      order.quantity,
//         status:        order.status,

//         // delivery info
//         deliveryStatus: delivery?.status || null,   // pending/picked/out_for_delivery/delivered
//         deliverDeadline: delivery?.deliverDeadline || null,  // 8 PM
//         estimatedWindow: delivery
//           ? { from: delivery.pickupWindowEnd, to: delivery.deliverDeadline }
//           : null,

//         // late info
//         isLate:     delivery?.isLate || false,
//         lateBy:     delivery?.lateBy || "none",

//         // address
//         deliveryAddress: order.deliveryAddress,

//         // timeline
//         steps,
//         currentStep,
//         progressPercent,
//       },
//     });
//   } catch (err) {
//     console.error("getOrderTracking error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };




// 📁 controllers/buyer/buyerOrder.js
const BuyerOrder   = require("../../models/buyer/buyerOrder");
const PlatformItem = require("../../models/masterData/PlatformItem");
const Country      = require("../../models/masterData/Country");
const Invoice      = require("../../models/invoice");
const Branch       = require("../../models/Branch");
const BulkOrder    = require("../../models/BulkOrder");
const Bid          = require("../../models/Bid");
const SupplierItem = require("../../models/supplier/supplierCatalog");
const mongoose     = require("mongoose");
const { getBiddingSettings, getCutoffMinutes } = require("../../cron/settingService");
const DeliveryOrder = require("../../models/riderCompany/orderDelivery");
const ReturnOrder   = require("../../models/returnOrder/ReturnOrder");

// Cancel window — bidding start se itne minute pehle tak cancel allowed hai.
// (Yeh BIDDING_CUTOFF se alag cheez hai — naam mat confuse karna.)
const CANCEL_WINDOW_MIN = 2;

// ─── Qatar time helpers (Qatar = UTC+3, cron ke saath bilkul consistent) ───
const getQatarNowParts = () => {
  const qatar = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return {
    year:   qatar.getUTCFullYear(),
    month:  qatar.getUTCMonth(),
    day:    qatar.getUTCDate(),
    hour:   qatar.getUTCHours(),
    minute: qatar.getUTCMinutes(),
  };
};

// Qatar ka abhi ka waqt — midnight se kitne minute (cutoff compare ke liye)
const getQatarMinutesNow = () => {
  const { hour, minute } = getQatarNowParts();
  return hour * 60 + minute;
};

// Qatar aaj ke din ka (hour:min) → asli UTC Date
const getTodayBiddingStart = (settings) => {
  const { year, month, day } = getQatarNowParts();
  const utcMs = Date.UTC(year, month, day, settings.BIDDING_START_HOUR, settings.BIDDING_START_MIN, 0, 0) - 3 * 60 * 60 * 1000;
  return new Date(utcMs);
};

const getTomorrowBiddingStart = (settings) => {
  const { year, month, day } = getQatarNowParts();
  const utcMs = Date.UTC(year, month, day + 1, settings.BIDDING_START_HOUR, settings.BIDDING_START_MIN, 0, 0) - 3 * 60 * 60 * 1000;
  return new Date(utcMs);
};

const getUsedPDC = async (branchId) => {
  const branchObjectId = new mongoose.Types.ObjectId(branchId);

  const pendingOrders = await BuyerOrder.aggregate([
    {
      $match: {
        buyerBranchId: branchObjectId,
        status: { $in: ["pending", "in_bidding", "won", "packed", "ready_for_pickup"] },
      },
    },
    { $group: { _id: null, total: { $sum: "$estimatedAmount" } } },
  ]);

  const unpaidInvoices = await Invoice.aggregate([
    {
      $match: {
        buyerBranchId: branchObjectId,
        invoiceType:   "buyer",
        paymentStatus: { $in: ["unpaid", "partial", "overdue"] },
      },
    },
    { $group: { _id: null, total: { $sum: "$amountDue" } } },
  ]);

  return (pendingOrders[0]?.total || 0) + (unpaidInvoices[0]?.total || 0);
};

// ─── Cancel ho sakta hai ya nahi (ek hi jagah rule) ───
// pending     → bidding start se 2 min pehle tak (taaki bulk me shamil na ho)
// in_bidding  → sirf jab WINDOW KHATAM ho gaya AUR koi bid nahi aayi (supplier nahi mila)
//               live bidding ke beech / bid aane par → cancel BAND
const computeCanCancel = ({ status, bidDate, biddingEndsAt, bidCount }) => {
  const now = new Date();

  if (status === "pending") {
    if (!bidDate) return false;
    const cutoff = new Date(new Date(bidDate).getTime() - CANCEL_WINDOW_MIN * 60 * 1000);
    return now < cutoff;
  }

  if (status === "in_bidding") {
    const ended  = biddingEndsAt ? now >= new Date(biddingEndsAt) : false;
    const noBids = (bidCount || 0) === 0;
    return ended && noBids;
  }

  return false;
};

// ═══════════════════════════════════════════════════════
//  BUYER — Place Order
// ═══════════════════════════════════════════════════════
exports.placeOrder = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can place orders" });
    }

    const { platformItemId, countryId, quantity, deliveryAddress } = req.body;

    if (!platformItemId || !countryId || !quantity) {
      return res.status(400).json({
        success: false,
        message: "platformItemId, countryId, and quantity are required",
      });
    }

    const buyerBranch = await Branch.findById(req.branch._id);
    if (!buyerBranch.pdcAmount) {
      return res.status(400).json({
        success: false,
        message: "Your PDC limit has not been set. Please contact the admin.",
      });
    }

    const platformItem = await PlatformItem.findById(platformItemId);
    if (!platformItem) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    const country = await Country.findById(countryId);
    if (!country) {
      return res.status(404).json({ success: false, message: "Country not found" });
    }

    const supplierItems = await SupplierItem.find({
      platformItemId,
      countryId,
      isListed:         true,
      isAvailableToday: true,
    });

    if (supplierItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No suppliers available for this item.",
      });
    }

    const prices          = supplierItems.map((s) => s.pricePerUnit);
    const minPrice        = Math.min(...prices);
    const maxPrice        = Math.max(...prices);
    const estimatedAmount = maxPrice * quantity;

    const usedAmount      = await getUsedPDC(req.branch._id);
    const remainingAmount = buyerBranch.pdcAmount - usedAmount;

    if (remainingAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Your PDC limit is fully utilized. Please clear your pending dues first.",
        data: { pdcLimit: buyerBranch.pdcAmount, used: usedAmount, remaining: 0 },
      });
    }

    if (estimatedAmount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient PDC. Estimated: ${estimatedAmount} QAR | Remaining: ${remainingAmount} QAR`,
        data: {
          pdcLimit:            buyerBranch.pdcAmount,
          used:                usedAmount,
          remaining:           remainingAmount,
          estimatedAmount,
          maxQuantityCanOrder: Math.floor(remainingAmount / maxPrice),
        },
      });
    }

    // ─── Cutoff comparison — ab HOUR + MINUTE dono ───────
    const settings   = await getBiddingSettings();
    const cutoffMins = getCutoffMinutes(settings);   // e.g. 15*60 + 45 = 945
    const nowMins    = getQatarMinutesNow();

    let bidDate, biddingMessage, biddingDateStr;

    if (nowMins < cutoffMins) {
      bidDate        = getTodayBiddingStart(settings);
      biddingDateStr = "Today";
      biddingMessage = `Order added to today's bidding.`;
    } else {
      bidDate        = getTomorrowBiddingStart(settings);
      biddingDateStr = "Tomorrow";
      biddingMessage = `Order will be in tomorrow's bidding.`;
    }

    const finalDeliveryAddress = deliveryAddress || {
      lat:     buyerBranch.address?.lat,
      lng:     buyerBranch.address?.lng,
      address: buyerBranch.address?.address,
      area:    buyerBranch.address?.area,
      city:    buyerBranch.address?.city,
    };

    const order = await BuyerOrder.create({
      buyerBranchId:   req.branch._id,
      buyerCompanyId:  req.branch.companyId,
      platformItemId,
      countryId,
      quantity,
      deliveryAddress: finalDeliveryAddress,
      bidDate,
      minPrice,
      maxPrice,
      estimatedAmount,
    });

    res.status(201).json({
      success: true,
      message: biddingMessage,
      data: {
        ...order.toObject(),
        biddingDay: biddingDateStr,
        pdcInfo: {
          pdcLimit:        buyerBranch.pdcAmount,
          used:            usedAmount + estimatedAmount,
          remaining:       remainingAmount - estimatedAmount,
          estimatedAmount,
        },
      },
    });
  } catch (err) {
    console.error("placeOrder error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  BUYER — Get My Orders
// ═══════════════════════════════════════════════════════
exports.getMyOrders = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can access this" });
    }

    const orders = await BuyerOrder.find({ buyerBranchId: req.branch._id })
      .populate("platformItemId", "name image unit")
      .populate("countryId", "name code")
      .sort({ createdAt: -1 });

    res.json({ success: true, total: orders.length, data: orders });
  } catch (err) {
    console.error("getMyOrders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  BUYER — Single Order Bidding Status (live + won + saved + canCancel)
//  GET /api/buyer/orders/:orderId/bidding-status
// ═══════════════════════════════════════════════════════
exports.getOrderBiddingStatus = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can access this" });
    }

    const order = await BuyerOrder.findOne({
      _id:           req.params.orderId,
      buyerBranchId: req.branch._id,
    })
      .populate("platformItemId", "name image unit")
      .populate("countryId", "name code");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const qty      = order.quantity;
    const minPrice = order.minPrice ?? null;
    const maxPrice = order.maxPrice ?? null;

    const blockedAmount = maxPrice ? Math.round(maxPrice * qty * 100) / 100 : null;

    const bulk = order.bulkOrderId
      ? await BulkOrder.findById(order.bulkOrderId).select(
          "winningPrice biddingEndsAt status"
        )
      : null;

    const base = {
      orderId:       order._id,
      itemName:      order.platformItemId?.name,
      itemImage:     order.platformItemId?.image,
      unit:          order.platformItemId?.unit,
      country:       order.countryId?.name,
      quantity:      qty,
      minRate:       minPrice,
      maxRate:       maxPrice,
      minAmount:     minPrice ? Math.round(minPrice * qty * 100) / 100 : null,
      maxAmount:     maxPrice ? Math.round(maxPrice * qty * 100) / 100 : null,
      blockedAmount,
      biddingEndsAt: bulk?.biddingEndsAt || order.bidDate,
      bidDate:       order.bidDate,
      status:        order.status,
    };

    // ─── WON phase ───────────────────────────────────────
    const WON_STATUSES = ["won", "packed", "ready_for_pickup", "delivered", "return_requested", "returned"];
    if (WON_STATUSES.includes(order.status) && bulk?.winningPrice != null) {
      const PLATFORM_FEE = 0.03;

      const baseRate    = bulk.winningPrice;
      const wonRate     = Math.round(baseRate * (1 + PLATFORM_FEE) * 100) / 100;
      const baseAmount  = Math.round(baseRate * qty * 100) / 100;
      const finalAmount = Math.round(wonRate * qty * 100) / 100;
      const feeAmount   = Math.round((finalAmount - baseAmount) * 100) / 100;
      const saved       = blockedAmount != null
        ? Math.round((blockedAmount - finalAmount) * 100) / 100
        : 0;

      // ─── Return order info ────────────────────────────
      const returnOrder = await ReturnOrder.findOne({ buyerOrderId: order._id })
        .select("status subject supplierNote adminNote createdAt")
        .sort({ createdAt: -1 });

      // ─── 24hr window check ────────────────────────────
      let withinReturnWindow = false;
      if (order.status === "delivered") {
        const invoice = await Invoice.findOne({ buyerOrderId: order._id, invoiceType: "buyer" })
          .select("deliveredAt");
        if (invoice?.deliveredAt) {
          const hours = (Date.now() - new Date(invoice.deliveredAt).getTime()) / (1000 * 60 * 60);
          withinReturnWindow = hours <= 24;
        }
      }

      return res.json({
        success: true,
        data: {
          ...base,
          phase:        "won",
          wonRate,
          baseRate,
          finalAmount,
          baseAmount,
          feeAmount,
          feePercent:   3,
          saved,
          savedPercent: blockedAmount ? Math.round((saved / blockedAmount) * 100) : 0,
          canCancel:    false,
          // ─── Return info ──────────────────────────────
          withinReturnWindow,
          returnRequest: returnOrder ? {
            status:         returnOrder.status,
            subject:        returnOrder.subject,
            supplierNote:   returnOrder.supplierNote || null,
            adminNote:      returnOrder.adminNote    || null,
            submittedAt:    returnOrder.createdAt,
          } : null,
        },
      });
    }

    // ─── PENDING + LIVE (in_bidding) ─────────────────────
    let currentLowestRate = null;
    let bidCount          = 0;
    let supplierCount     = 0;
    let windowEnded       = false;

    if (order.status === "in_bidding" && order.bulkOrderId) {
      // PROXY BIDDING: live rate ab BulkOrder.currentBid pe cached hai.
      // Buyer ko currentBid dikhta hai — kisi supplier ki maxBid nahi.
      const bulkLive = await BulkOrder.findById(order.bulkOrderId)
        .select("currentBid");
      currentLowestRate = bulkLive?.currentBid ?? null;

      bidCount = await Bid.countDocuments({
        bulkOrderId: order.bulkOrderId,
        status:      "active",
      });

      supplierCount = await SupplierItem.countDocuments({
        platformItemId:   order.platformItemId._id,
        countryId:        order.countryId._id,
        isListed:         true,
        isAvailableToday: true,
      });

      if (bulk?.biddingEndsAt) {
        windowEnded = new Date(bulk.biddingEndsAt) <= new Date();
      }
    } else if (order.status === "pending") {
      supplierCount = await SupplierItem.countDocuments({
        platformItemId:   order.platformItemId._id,
        countryId:        order.countryId._id,
        isListed:         true,
        isAvailableToday: true,
      });
    }

    const canCancel = computeCanCancel({
      status:        order.status,
      bidDate:       order.bidDate,
      biddingEndsAt: bulk?.biddingEndsAt,
      bidCount,
    });

    return res.json({
      success: true,
      data: {
        ...base,
        phase:               order.status === "pending" ? "pending" : "bidding",
        currentLowestRate,
        currentLowestAmount: currentLowestRate
          ? Math.round(currentLowestRate * qty * 100) / 100
          : null,
        bidCount,
        supplierCount,
        noSupplier:  supplierCount === 0,
        windowEnded,
        canCancel,
      },
    });
  } catch (err) {
    console.error("getOrderBiddingStatus error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  BUYER — Cancel Order
//  pending     → bidding start se 2 min pehle tak
//  in_bidding  → sirf jab window khatam ho gaya AUR koi bid nahi aayi
// ═══════════════════════════════════════════════════════
exports.cancelOrder = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can cancel orders" });
    }

    const order = await BuyerOrder.findOne({
      _id:           req.params.orderId,
      buyerBranchId: req.branch._id,
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== "pending" && order.status !== "in_bidding") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel — status: ${order.status}`,
      });
    }

    // Order pe abhi tak koi BID aayi ya nahi + window end time
    let bidCount      = 0;
    let biddingEndsAt = null;
    if (order.status === "in_bidding" && order.bulkOrderId) {
      bidCount = await Bid.countDocuments({
        bulkOrderId: order.bulkOrderId,
        status:      "active",
      });
      const bulk = await BulkOrder.findById(order.bulkOrderId).select("biddingEndsAt");
      biddingEndsAt = bulk?.biddingEndsAt || null;
    }

    const allowed = computeCanCancel({
      status:   order.status,
      bidDate:  order.bidDate,
      biddingEndsAt,
      bidCount,
    });

    if (!allowed) {
      let msg = `Cannot cancel — status: ${order.status}`;
      if (order.status === "pending") {
        msg = "Cannot cancel — bidding starts in less than 2 minutes";
      } else if (order.status === "in_bidding") {
        msg = bidCount > 0
          ? "A bid has already been placed on your order — cannot cancel now."
          : "Bidding is in progress — you can cancel only after it ends if no supplier is found.";
      }
      return res.status(400).json({ success: false, message: msg });
    }

    await BuyerOrder.findByIdAndUpdate(order._id, {
      status:          "cancelled",
      estimatedAmount: 0,
    });

    res.json({ success: true, message: "Order cancelled. PDC amount has been released." });
  } catch (err) {
    console.error("cancelOrder error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  BUYER — Return Request
// ═══════════════════════════════════════════════════════
exports.returnOrder = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can request a return" });
    }

    const { reason } = req.body;
    const validReasons = ["incorrect", "damaged", "rotten", "expired"];
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: "Return reason must be: incorrect, damaged, rotten, or expired",
      });
    }

    const order = await BuyerOrder.findOne({
      _id:           req.params.orderId,
      buyerBranchId: req.branch._id,
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "Only delivered orders can be returned",
      });
    }

    const invoice = await Invoice.findOne({
      buyerOrderId: order._id,
      invoiceType:  "buyer",
    });

    if (!invoice || !invoice.deliveredAt) {
      return res.status(400).json({ success: false, message: "Delivery info not found" });
    }

    const hoursPassed = (new Date() - new Date(invoice.deliveredAt)) / (1000 * 60 * 60);
    if (hoursPassed > 24) {
      return res.status(400).json({
        success: false,
        message: "Return window closed — only within 24 hours of delivery",
      });
    }

    await BuyerOrder.findByIdAndUpdate(order._id, { status: "return_requested" });
    await Invoice.findByIdAndUpdate(invoice._id, {
      deliveryStatus: "returned",
      returnReason:   reason,
    });

    res.json({
      success: true,
      message: "Return request submitted. PDC will be released after supplier approval.",
    });
  } catch (err) {
    console.error("returnOrder error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  BUYER — Get My Invoices
// ═══════════════════════════════════════════════════════
exports.getMyInvoices = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can access this" });
    }

    const invoices = await Invoice.find({
      buyerBranchId: req.branch._id,
      invoiceType:   "buyer",
    })
      .populate("platformItemId", "name image unit")
      .populate("countryId", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, total: invoices.length, data: invoices });
  } catch (err) {
    console.error("getMyInvoices error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  BUYER — Order Tracking (delivery progress)
//  GET /api/buyer/orders/:orderId/tracking
// ═══════════════════════════════════════════════════════
exports.getOrderTracking = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can access this" });
    }

    const order = await BuyerOrder.findOne({
      _id:           req.params.orderId,
      buyerBranchId: req.branch._id,
    })
      .populate("platformItemId", "name image unit")
      .populate("countryId", "name code");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Delivery order (agar bana ho — ready hone ke baad)
    let delivery = null;
    if (order.bulkOrderId) {
      delivery = await DeliveryOrder.findOne({ bulkOrderId: order.bulkOrderId });
    }

    // Is buyer ka apna stop (delivery ke andar)
    let myStop = null;
    if (delivery) {
      myStop = delivery.deliveries.find(
        (d) => d.buyerOrderId.toString() === order._id.toString()
      );
    }

    // ─── Timeline steps (5 step) ───
    // 1 won/awarded → Supplier Preparing
    // 2 packed      → Order Packed
    // 3 picked      → Dispatched (rider uthaya)
    // 4 out_for_delivery → In Transit
    // 5 delivered   → Delivered

    const steps = [
      {
        key:   "preparing",
        title: "Supplier Preparing Order",
        sub:   "Your order is confirmed and being prepared.",
        done:  ["won", "packed", "ready_for_pickup", "delivered"].includes(order.status),
        time:  order.status === "won" ? order.updatedAt : null,
      },
      {
        key:   "packed",
        title: "Order Packed",
        sub:   "Your order has been packed and is ready for pickup.",
        done:  ["packed", "ready_for_pickup", "delivered"].includes(order.status),
        time:  delivery?.readyAt || null,
      },
      {
        key:   "dispatched",
        title: "Dispatched",
        sub:   "Package has been picked up by the courier.",
        done:  ["ready_for_pickup", "delivered"].includes(order.status) &&
               !!delivery && ["picked", "out_for_delivery", "delivered"].includes(delivery.status),
        time:  delivery?.pickedAt || null,
      },
      {
        key:   "in_transit",
        title: "In Transit",
        sub:   "Package is on the way to your location.",
        done:  !!delivery && ["out_for_delivery", "delivered"].includes(delivery.status),
        time:  null,
      },
      {
        key:   "delivered",
        title: "Delivered",
        sub:   "Package delivered to your address.",
        done:  order.status === "delivered" || myStop?.status === "delivered",
        time:  myStop?.deliveredAt || delivery?.deliveredAt || null,
      },
    ];

    // current step index (last done)
    let currentStep = 0;
    steps.forEach((s, i) => { if (s.done) currentStep = i; });

    // progress %
    const progressPercent = Math.round((currentStep / (steps.length - 1)) * 100);

    res.json({
      success: true,
      data: {
        orderId:       order._id,
        orderNumber:   `#ORD-${order._id.toString().slice(-6).toUpperCase()}`,
        itemName:      order.platformItemId?.name,
        itemImage:     order.platformItemId?.image,
        unit:          order.platformItemId?.unit,
        country:       order.countryId?.name,
        quantity:      order.quantity,
        status:        order.status,

        // delivery info
        deliveryStatus: delivery?.status || null,   // pending/picked/out_for_delivery/delivered
        deliverDeadline: delivery?.deliverDeadline || null,  // 8 PM
        estimatedWindow: delivery
          ? { from: delivery.pickupWindowEnd, to: delivery.deliverDeadline }
          : null,

        // late info
        isLate:     delivery?.isLate || false,
        lateBy:     delivery?.lateBy || "none",

        // address
        deliveryAddress: order.deliveryAddress,

        // timeline
        steps,
        currentStep,
        progressPercent,
      },
    });
  } catch (err) {
    console.error("getOrderTracking error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};