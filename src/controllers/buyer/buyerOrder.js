

// // 📁 controllers/buyer/buyerOrder.js
// const BuyerOrder   = require("../../models/buyer/buyerOrder");
// const PlatformItem = require("../../models/PlatformItem");
// const Country      = require("../../models/Country");
// const Invoice      = require("../../models/invoice");
// const Branch       = require("../../models/Branch");
// const BulkOrder    = require("../../models/BulkOrder");
// const Bid          = require("../../models/Bid");
// const SupplierItem = require("../../models/supplier/supplierCatalog");
// const mongoose     = require("mongoose");
// const { getBiddingSettings } = require("../../cron/settingService");

// const CANCEL_CUTOFF_MIN = 2;

// const getQatarNow = () => {
//   const now = new Date();
//   return new Date(now.getTime() + 3 * 60 * 60 * 1000);
// };

// // bidding start time (DB settings se) — Qatar time ko UTC mein convert
// const getTodayBiddingStart = (settings) => {
//   const start = new Date();
//   start.setUTCHours(settings.BIDDING_START_HOUR - 3, settings.BIDDING_START_MIN, 0, 0);
//   return start;
// };

// const getTomorrowBiddingStart = (settings) => {
//   const start = getTodayBiddingStart(settings);
//   start.setDate(start.getDate() + 1);
//   return start;
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

//     // ─── Min + Max nikalo (yehi order pe save hongi) ───
//     const prices          = supplierItems.map((s) => s.pricePerUnit);
//     const minPrice        = Math.min(...prices);
//     const maxPrice        = Math.max(...prices);
//     const estimatedAmount = maxPrice * quantity;   // PDC max price pe block hoti hai

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

//     // ─── Bidding day decide (DB settings cutoff se) ───
//     const settings = await getBiddingSettings();
//     const CUTOFF   = settings.BIDDING_CUTOFF_HOUR;

//     const qatarNow  = getQatarNow();
//     const qatarHour = qatarNow.getUTCHours();

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
//       minPrice,          // ← save
//       maxPrice,          // ← save
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
// //  BUYER — Single Order Bidding Status (live + won + saved)
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

//     // Max rate pe PDC block hua tha
//     const blockedAmount = maxPrice ? Math.round(maxPrice * qty * 100) / 100 : null;

//     // BulkOrder se winningPrice + biddingEndsAt
//     const bulk = order.bulkOrderId
//       ? await BulkOrder.findById(order.bulkOrderId).select("winningPrice biddingEndsAt status")
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
//       status:        order.status,
//     };

//     // ─── WON phase ───────────────────────────────────────
//     if (order.status === "won" && bulk?.winningPrice != null) {
//       const wonRate     = bulk.winningPrice;
//       const finalAmount = Math.round(wonRate * qty * 100) / 100;
//       const saved       = blockedAmount != null
//         ? Math.round((blockedAmount - finalAmount) * 100) / 100
//         : 0;

//       return res.json({
//         success: true,
//         data: {
//           ...base,
//           phase:        "won",
//           wonRate,
//           finalAmount,
//           saved,
//           savedPercent: blockedAmount ? Math.round((saved / blockedAmount) * 100) : 0,
//         },
//       });
//     }

//     // ─── LIVE phase (in_bidding) ─────────────────────────
//     let currentLowestRate = null;
//     let bidCount          = 0;

//     if (order.status === "in_bidding" && order.bulkOrderId) {
//       const lowest = await Bid.findOne({ bulkOrderId: order.bulkOrderId })
//         .sort({ pricePerUnit: 1 })
//         .select("pricePerUnit");

//       currentLowestRate = lowest?.pricePerUnit ?? null;
//       bidCount          = await Bid.countDocuments({ bulkOrderId: order.bulkOrderId });
//     }

//     return res.json({
//       success: true,
//       data: {
//         ...base,
//         phase:               order.status === "pending" ? "pending" : "bidding",
//         currentLowestRate,                                       // ← "your item bid rate is"
//         currentLowestAmount: currentLowestRate
//           ? Math.round(currentLowestRate * qty * 100) / 100
//           : null,
//         bidCount,
//       },
//     });
//   } catch (err) {
//     console.error("getOrderBiddingStatus error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  BUYER — Cancel Order  (sirf "pending" — bidding shuru hone se pehle)
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

//     // ─── Bulk order ban gaya / bidding shuru → cancel nahi ───
//     if (order.status !== "pending") {
//       return res.status(400).json({
//         success: false,
//         message: order.status === "in_bidding"
//           ? "Bidding in progress — cannot cancel"
//           : `Cannot cancel — status: ${order.status}`,
//       });
//     }

//     const biddingStart = new Date(order.bidDate);
//     const cancelCutoff = new Date(biddingStart.getTime() - CANCEL_CUTOFF_MIN * 60 * 1000);

//     if (new Date() >= cancelCutoff) {
//       return res.status(400).json({
//         success: false,
//         message: "Cannot cancel — bidding starts in less than 2 minutes",
//       });
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




// 📁 controllers/buyer/buyerOrder.js
const BuyerOrder   = require("../../models/buyer/buyerOrder");
const PlatformItem = require("../../models/PlatformItem");
const Country      = require("../../models/Country");
const Invoice      = require("../../models/invoice");
const Branch       = require("../../models/Branch");
const BulkOrder    = require("../../models/BulkOrder");
const Bid          = require("../../models/Bid");
const SupplierItem = require("../../models/supplier/supplierCatalog");
const mongoose     = require("mongoose");
const { getBiddingSettings } = require("../../cron/settingService");

const CANCEL_CUTOFF_MIN = 2;

const getQatarNow = () => {
  const now = new Date();
  return new Date(now.getTime() + 3 * 60 * 60 * 1000);
};

const getTodayBiddingStart = (settings) => {
  const start = new Date();
  start.setUTCHours(settings.BIDDING_START_HOUR - 3, settings.BIDDING_START_MIN, 0, 0);
  return start;
};

const getTomorrowBiddingStart = (settings) => {
  const start = getTodayBiddingStart(settings);
  start.setDate(start.getDate() + 1);
  return start;
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

    // ─── Min + Max nikalo (yehi order pe save hongi) ───
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

    // ─── Bidding day decide (DB settings cutoff se) ───
    const settings = await getBiddingSettings();
    const CUTOFF   = settings.BIDDING_CUTOFF_HOUR;

    const qatarNow  = getQatarNow();
    const qatarHour = qatarNow.getUTCHours();

    let bidDate, biddingMessage, biddingDateStr;

    if (qatarHour < CUTOFF) {
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
//  BUYER — Single Order Bidding Status (live + won + saved)
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
      ? await BulkOrder.findById(order.bulkOrderId).select("winningPrice biddingEndsAt status")
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
      status:        order.status,
    };

    // ─── WON phase ───────────────────────────────────────
    if (order.status === "won" && bulk?.winningPrice != null) {
      const wonRate     = bulk.winningPrice;
      const finalAmount = Math.round(wonRate * qty * 100) / 100;
      const saved       = blockedAmount != null
        ? Math.round((blockedAmount - finalAmount) * 100) / 100
        : 0;

      return res.json({
        success: true,
        data: {
          ...base,
          phase:        "won",
          wonRate,
          finalAmount,
          saved,
          savedPercent: blockedAmount ? Math.round((saved / blockedAmount) * 100) : 0,
        },
      });
    }

    // ─── LIVE phase (in_bidding) ─────────────────────────
    let currentLowestRate = null;
    let bidCount          = 0;
    let supplierCount     = 0;       // ← NEW: kitne supplier eligible
    let windowEnded       = false;   // ← NEW: bidding window khatam hua?

    if (order.status === "in_bidding" && order.bulkOrderId) {
      const lowest = await Bid.findOne({ bulkOrderId: order.bulkOrderId })
        .sort({ pricePerUnit: 1 })
        .select("pricePerUnit");

      currentLowestRate = lowest?.pricePerUnit ?? null;
      bidCount          = await Bid.countDocuments({ bulkOrderId: order.bulkOrderId });

      // Kitne supplier is item + country pe abhi available hain
      supplierCount = await SupplierItem.countDocuments({
        platformItemId:   order.platformItemId._id,
        countryId:        order.countryId._id,
        isListed:         true,
        isAvailableToday: true,
      });

      // Window khatam hua ya nahi
      if (bulk?.biddingEndsAt) {
        windowEnded = new Date(bulk.biddingEndsAt) <= new Date();
      }
    }

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
        supplierCount,                      // ← NEW
        noSupplier:  supplierCount === 0,   // ← NEW
        windowEnded,                        // ← NEW
      },
    });
  } catch (err) {
    console.error("getOrderBiddingStatus error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  BUYER — Cancel Order  (sirf "pending")
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

    if (order.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: order.status === "in_bidding"
          ? "Bidding in progress — cannot cancel"
          : `Cannot cancel — status: ${order.status}`,
      });
    }

    const biddingStart = new Date(order.bidDate);
    const cancelCutoff = new Date(biddingStart.getTime() - CANCEL_CUTOFF_MIN * 60 * 1000);

    if (new Date() >= cancelCutoff) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel — bidding starts in less than 2 minutes",
      });
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