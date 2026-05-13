
const BuyerOrder   = require("../../models/buyer/buyerOrder");
const PlatformItem = require("../../models/PlatformItem");
const Country      = require("../../models/Country");
const Invoice      = require("../../models/invoice");
const Branch       = require("../../models/Branch");
const SupplierItem = require("../../models/supplier/supplierCatalog");
const mongoose     = require("mongoose");
const { SETTINGS } = require("../../cron/biddingCron");

const BIDDING_START_HOUR = SETTINGS.BIDDING_START_QATAR;
const CANCEL_CUTOFF_MIN  = 2;

const getQatarNow = () => {
  const now = new Date();
  return new Date(now.getTime() + 3 * 60 * 60 * 1000);
};

const getTodayBiddingStart = () => {
  const start = new Date();
  start.setUTCHours(BIDDING_START_HOUR - 3, 0, 0, 0);
  return start;
};

const getTomorrowBiddingStart = () => {
  const start = getTodayBiddingStart();
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

    const prices          = supplierItems.map((s) => s.pricePerUnit);
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

    const qatarNow  = getQatarNow();
    const qatarHour = qatarNow.getUTCHours();

    let bidDate, biddingMessage, biddingDateStr;

    if (qatarHour < BIDDING_START_HOUR) {
      bidDate        = getTodayBiddingStart();
      biddingDateStr = "Today";
      biddingMessage = `Order added to today's bidding.`;
    } else {
      bidDate        = getTomorrowBiddingStart();
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
//  BUYER — Cancel Order
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







// const BuyerOrder   = require("../../models/buyer/buyerOrder");
// const PlatformItem = require("../../models/PlatformItem");
// const Country      = require("../../models/Country");
// const Invoice      = require("../../models/invoice");
// const Branch       = require("../../models/branch");
// const SupplierItem = require("../../models/supplier/supplierCatalog");
// const mongoose     = require("mongoose");

// const BIDDING_START_HOUR = 17;
// const CANCEL_CUTOFF_MIN  = 2;

// const getQatarNow = () => {
//   const now = new Date();
//   return new Date(now.getTime() + 3 * 60 * 60 * 1000);
// };

// const getTodayBiddingStart = () => {
//   const start = new Date();
//   start.setUTCHours(BIDDING_START_HOUR - 3, 0, 0, 0);
//   return start;
// };

// const getTomorrowBiddingStart = () => {
//   const start = getTodayBiddingStart();
//   start.setDate(start.getDate() + 1);
//   return start;
// };

// const getUsedPDC = async (branchId) => {
//   const branchObjectId = new mongoose.Types.ObjectId(branchId);

//   const pendingOrders = await BuyerOrder.aggregate([
//     {
//       $match: {
//         buyerBranchId: branchObjectId,
//         status: { $in: ["pending", "in_bidding", "won"] },
//       },
//     },
//     { $group: { _id: null, total: { $sum: "$estimatedAmount" } } },
//   ]);

//   const unpaidInvoices = await Invoice.aggregate([
//     {
//       $match: {
//         buyerBranchId: branchObjectId,
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

//     const prices          = supplierItems.map((s) => s.pricePerUnit);
//     const maxPrice        = Math.max(...prices);
//     const estimatedAmount = maxPrice * quantity;

//     const usedAmount      = await getUsedPDC(req.branch._id);
//     const remainingAmount = buyerBranch.pdcAmount - usedAmount;

//     if (remainingAmount <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Your PDC limit is fully utilized. Please clear your pending dues first.",
//         data: {
//           pdcLimit:  buyerBranch.pdcAmount,
//           used:      usedAmount,
//           remaining: 0,
//         },
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

//     const qatarNow  = getQatarNow();
//     const qatarHour = qatarNow.getUTCHours();

//     let bidDate, biddingMessage, biddingDateStr;

//     if (qatarHour < BIDDING_START_HOUR) {
//       bidDate        = getTodayBiddingStart();
//       biddingDateStr = "Today";
//       biddingMessage = "Order added to today's bidding. Bidding: 2:00 PM – 3:00 PM";
//     } else {
//       bidDate        = getTomorrowBiddingStart();
//       biddingDateStr = "Tomorrow";
//       biddingMessage = "Order will be in tomorrow's bidding. Bidding: 2:00 PM – 3:00 PM";
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
//       estimatedAmount,
//     });

//     res.status(201).json({
//       success: true,
//       message: biddingMessage,
//       data: {
//         ...order.toObject(),
//         biddingDay:   biddingDateStr,
//         biddingStart: "2:00 PM",
//         biddingEnd:   "3:00 PM",
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
// //  BUYER — Cancel Order
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

//     // ← PDC turant free
//     await BuyerOrder.findByIdAndUpdate(order._id, {
//       status:          "cancelled",
//       estimatedAmount: 0,
//     });

//     res.json({
//       success: true,
//       message: "Order cancelled. PDC amount has been released.",
//     });
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

//     const invoice = await Invoice.findOne({ buyerOrderId: order._id });
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

//     // ← Sirf request submit — PDC tab free hogi jab supplier accept kare
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









// const BuyerOrder   = require("../../models/buyer/buyerOrder");
// const PlatformItem = require("../../models/PlatformItem");
// const Country      = require("../../models/Country");
// const Invoice      = require("../../models/invoice");
// const Branch       = require("../../models/branch");
// const SupplierItem = require("../../models/supplier/supplierCatalog");
// const mongoose     = require("mongoose");

// const BIDDING_START_HOUR = 17;
// const CANCEL_CUTOFF_MIN  = 2;

// const getQatarNow = () => {
//   const now = new Date();
//   return new Date(now.getTime() + 3 * 60 * 60 * 1000);
// };

// const getTodayBiddingStart = () => {
//   const start = new Date();
//   start.setUTCHours(BIDDING_START_HOUR - 3, 0, 0, 0);
//   return start;
// };

// const getTomorrowBiddingStart = () => {
//   const start = getTodayBiddingStart();
//   start.setDate(start.getDate() + 1);
//   return start;
// };

// const getUsedPDC = async (branchId) => {
//   const branchObjectId = new mongoose.Types.ObjectId(branchId);

//   const pendingOrders = await BuyerOrder.aggregate([
//     {
//       $match: {
//         buyerBranchId: branchObjectId,
//         status: { $in: ["pending", "in_bidding", "won"] },
//       },
//     },
//     { $group: { _id: null, total: { $sum: "$estimatedAmount" } } },
//   ]);

//   const unpaidInvoices = await Invoice.aggregate([
//     {
//       $match: {
//         buyerBranchId: branchObjectId,
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

//     const prices          = supplierItems.map((s) => s.pricePerUnit);
//     const maxPrice        = Math.max(...prices);
//     const estimatedAmount = maxPrice * quantity;

//     const usedAmount      = await getUsedPDC(req.branch._id);
//     const remainingAmount = buyerBranch.pdcAmount - usedAmount;

//     if (remainingAmount <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Your PDC limit is fully utilized. Please clear your pending dues first.",
//         data: {
//           pdcLimit:  buyerBranch.pdcAmount,
//           used:      usedAmount,
//           remaining: 0,
//         },
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

//     const qatarNow  = getQatarNow();
//     const qatarHour = qatarNow.getUTCHours();

//     let bidDate, biddingMessage, biddingDateStr;

//     if (qatarHour < BIDDING_START_HOUR) {
//       bidDate        = getTodayBiddingStart();
//       biddingDateStr = "Today";
//       biddingMessage = "Order added to today's bidding. Bidding: 2:00 PM – 3:00 PM";
//     } else {
//       bidDate        = getTomorrowBiddingStart();
//       biddingDateStr = "Tomorrow";
//       biddingMessage = "Order will be in tomorrow's bidding. Bidding: 2:00 PM – 3:00 PM";
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
//       estimatedAmount,
//     });

//     res.status(201).json({
//       success: true,
//       message: biddingMessage,
//       data: {
//         ...order.toObject(),
//         biddingDay:   biddingDateStr,
//         biddingStart: "2:00 PM",
//         biddingEnd:   "3:00 PM",
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
// //  BUYER — Cancel Order
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

//     // ← PDC turant free
//     await BuyerOrder.findByIdAndUpdate(order._id, {
//       status:          "cancelled",
//       estimatedAmount: 0,
//     });

//     res.json({
//       success: true,
//       message: "Order cancelled. PDC amount has been released.",
//     });
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

//     const invoice = await Invoice.findOne({ buyerOrderId: order._id });
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

//     // ← Sirf request submit — PDC tab free hogi jab supplier accept kare
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