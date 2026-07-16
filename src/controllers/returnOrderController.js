// // 📁 controllers/returnOrderController.js
// const ReturnOrder    = require("../models/returnOrder/ReturnOrder");
// const ReturnDelivery = require("../models/returnOrder/ReturnDelivery");
// const SupplierDebt   = require("../models/returnOrder/SupplierDebt");
// const RiderDebt      = require("../models/returnOrder/RiderDebt");
// const BuyerOrder     = require("../models/buyer/buyerOrder");
// const BulkOrder      = require("../models/BulkOrder");
// const Invoice        = require("../models/invoice");
// const Branch         = require("../models/Branch");
// const DeliveryOrder  = require("../models/riderCompany/orderDelivery");
// const { uploadToFirebase } = require("../config/uploadToFirebase");

// // ═══════════════════════════════════════════════════════
// //  BUYER — Submit Return Request
// //  POST /api/returns/buyer/submit
// //  Body: { buyerOrderId, subject, description }
// //  Files: images (max 3)
// // ═══════════════════════════════════════════════════════
// exports.submitReturn = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Buyer") {
//       return res.status(403).json({ success: false, message: "Only buyers can submit returns" });
//     }

//     const { buyerOrderId, subject, description } = req.body;

//     if (!buyerOrderId || !subject || !description) {
//       return res.status(400).json({ success: false, message: "buyerOrderId, subject, description required" });
//     }

//     const order = await BuyerOrder.findOne({
//       _id:           buyerOrderId,
//       buyerBranchId: req.branch._id,
//       status:        "delivered",
//     });

//     if (!order) {
//       return res.status(404).json({ success: false, message: "Delivered order not found" });
//     }

//     // 24hr window check
//     const invoice = await Invoice.findOne({
//       buyerOrderId: order._id,
//       invoiceType:  "buyer",
//     });

//     if (!invoice?.deliveredAt) {
//       return res.status(400).json({ success: false, message: "Delivery info not found" });
//     }

//     const hoursPassed = (Date.now() - new Date(invoice.deliveredAt).getTime()) / (1000 * 60 * 60);
//     if (hoursPassed > 24) {
//       return res.status(400).json({ success: false, message: "Return window closed — only within 24 hours of delivery" });
//     }

//     // Existing return check
//     const existing = await ReturnOrder.findOne({ buyerOrderId: order._id });
//     if (existing) {
//       return res.status(400).json({ success: false, message: "Return request already submitted for this order" });
//     }

//     // Upload images
//     const imageUrls = [];
//     if (req.files?.length) {
//       const maxImages = Math.min(req.files.length, 3);
//       for (let i = 0; i < maxImages; i++) {
//         const url = await uploadToFirebase(
//           req.files[i].buffer,
//           req.files[i].originalname,
//           `return-images/${req.branch._id}`
//         );
//         imageUrls.push(url);
//       }
//     }

//     // Get delivery company from DeliveryOrder
//     const deliveryOrder = await DeliveryOrder.findOne({ bulkOrderId: order.bulkOrderId });

//     // Get supplier invoice for amounts
//     const supplierInvoice = await Invoice.findOne({
//       buyerOrderId: order._id,
//       invoiceType:  "supplier",
//     });

//     const penaltyAmount = Math.round((supplierInvoice?.grandTotal || 0) * 0.02 * 100) / 100;

//     const returnOrder = await ReturnOrder.create({
//       buyerOrderId:     order._id,
//       bulkOrderId:      order.bulkOrderId,
//       buyerBranchId:    req.branch._id,
//       supplierBranchId: invoice.supplierBranchId,
//       invoiceId:        invoice._id,
//       deliveryOrderId:  deliveryOrder?._id || null,
//       deliveryCompanyId: deliveryOrder?.deliveryCompanyId || null,
//       subject,
//       description,
//       images: imageUrls,
//       orderGrandTotal:  invoice.grandTotal,
//       orderRawAmount:   invoice.totalAmount,
//       deliveryCharge:   invoice.deliveryAmount,
//       commissionAmount: invoice.commissionAmount,
//       penaltyAmount,
//     });

//     // BuyerOrder status update
//     await BuyerOrder.findByIdAndUpdate(order._id, { status: "return_requested" });

//     res.status(201).json({
//       success: true,
//       message: "Return request submitted ✅",
//       data: {
//         returnOrderId: returnOrder._id,
//         status:        returnOrder.status,
//       },
//     });
//   } catch (err) {
//     console.error("submitReturn error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  BUYER — Get My Return Orders
// //  GET /api/returns/buyer/my-returns
// // ═══════════════════════════════════════════════════════
// exports.getMyReturns = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Buyer") {
//       return res.status(403).json({ success: false, message: "Only buyers can access this" });
//     }

//     const returns = await ReturnOrder.find({ buyerBranchId: req.branch._id })
//       .populate("buyerOrderId",  "quantity status")
//       .populate("invoiceId",     "invoiceNumber grandTotal")
//       .populate("bulkOrderId",   "platformItemId countryId")
//       .sort({ createdAt: -1 });

//     res.json({ success: true, total: returns.length, data: returns });
//   } catch (err) {
//     console.error("getMyReturns error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  SUPPLIER — Get Return Requests
// //  GET /api/returns/supplier/requests
// // ═══════════════════════════════════════════════════════
// exports.getSupplierReturns = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Supplier") {
//       return res.status(403).json({ success: false, message: "Only suppliers can access this" });
//     }

//     const returns = await ReturnOrder.find({
//       supplierBranchId: req.branch._id,
//       status: { $in: ["pending", "supplier_accepted", "supplier_rejected"] },
//     })
//       .populate("buyerBranchId", "managerName companyName")
//       .populate("invoiceId",     "invoiceNumber grandTotal totalAmount")
//       .sort({ createdAt: -1 });

//     res.json({ success: true, total: returns.length, data: returns });
//   } catch (err) {
//     console.error("getSupplierReturns error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  SUPPLIER — Respond to Return
// //  PUT /api/returns/supplier/:returnId/respond
// //  Body: { action: "accept" | "reject", note }
// // ═══════════════════════════════════════════════════════
// exports.supplierRespond = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Supplier") {
//       return res.status(403).json({ success: false, message: "Only suppliers can respond" });
//     }

//     const { action, note } = req.body;
//     if (!["accept", "reject"].includes(action)) {
//       return res.status(400).json({ success: false, message: "action must be accept or reject" });
//     }
//     if (action === "reject" && !note) {
//       return res.status(400).json({ success: false, message: "Rejection reason required" });
//     }

//     const returnOrder = await ReturnOrder.findOne({
//       _id:              req.params.returnId,
//       supplierBranchId: req.branch._id,
//       status:           "pending",
//     });

//     if (!returnOrder) {
//       return res.status(404).json({ success: false, message: "Return request not found" });
//     }

//     await ReturnOrder.findByIdAndUpdate(returnOrder._id, {
//       status:              action === "accept" ? "supplier_accepted" : "supplier_rejected",
//       supplierNote:        note || null,
//       supplierRespondedAt: new Date(),
//     });

//     res.json({
//       success: true,
//       message: action === "accept" ? "Return accepted" : "Return rejected",
//     });
//   } catch (err) {
//     console.error("supplierRespond error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  ADMIN — Get All Return Orders
// //  GET /api/returns/admin/all?status=pending
// // ═══════════════════════════════════════════════════════
// exports.adminGetReturns = async (req, res) => {
//   try {
//     const { status, page = 1, limit = 20 } = req.query;
//     const filter = {};
//     if (status) filter.status = status;

//     const skip  = (Number(page) - 1) * Number(limit);
//     const total = await ReturnOrder.countDocuments(filter);

//     const returns = await ReturnOrder.find(filter)
//       .populate("buyerBranchId",    "managerName companyName email")
//       .populate("supplierBranchId", "managerName companyName email")
//       .populate("invoiceId",        "invoiceNumber grandTotal totalAmount deliveryAmount commissionAmount")
//       .populate("bulkOrderId",      "winningPrice totalQuantity")
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(Number(limit));

//     res.json({
//       success: true,
//       total,
//       page:  Number(page),
//       pages: Math.ceil(total / Number(limit)),
//       data:  returns,
//     });
//   } catch (err) {
//     console.error("adminGetReturns error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  ADMIN — Resolve Return Order
// //  PUT /api/returns/admin/:returnId/resolve
// //  Body: { decision: "cancel" | "supplier_guilty" | "rider_guilty", note }
// // ═══════════════════════════════════════════════════════
// exports.adminResolve = async (req, res) => {
//   try {
//     const { decision, note } = req.body;

//     if (!["cancel", "supplier_guilty", "rider_guilty"].includes(decision)) {
//       return res.status(400).json({ success: false, message: "Invalid decision" });
//     }

//     const returnOrder = await ReturnOrder.findById(req.params.returnId)
//       .populate("invoiceId");

//     if (!returnOrder) {
//       return res.status(404).json({ success: false, message: "Return order not found" });
//     }

//     if (returnOrder.status.startsWith("resolved_")) {
//       return res.status(400).json({ success: false, message: "Already resolved" });
//     }

//     const invoice = returnOrder.invoiceId;
//     const now     = new Date();

//     // ─── CANCEL ─────────────────────────────────────────
//     if (decision === "cancel") {
//       await ReturnOrder.findByIdAndUpdate(returnOrder._id, {
//         status:         "resolved_cancelled",
//         adminNote:      note || null,
//         adminResolvedAt: now,
//         resolvedBy:     req.admin._id,
//       });

//       // BuyerOrder wapas delivered
//       await BuyerOrder.findByIdAndUpdate(returnOrder.buyerOrderId, { status: "delivered" });

//       return res.json({ success: true, message: "Return request cancelled" });
//     }

//     // ─── SUPPLIER GUILTY ─────────────────────────────────
//     if (decision === "supplier_guilty") {
//       // 1. Buyer invoice cancel
//       await Invoice.findByIdAndUpdate(invoice._id, {
//         paymentStatus: "cancelled",
//         amountDue:     0,
//       });

//       // 2. Supplier invoice cancel
//       const supplierInvoice = await Invoice.findOne({
//         buyerOrderId: returnOrder.buyerOrderId,
//         invoiceType:  "supplier",
//       });
//       if (supplierInvoice) {
//         await Invoice.findByIdAndUpdate(supplierInvoice._id, {
//           supplierPaymentStatus: "deducted",
//           amountDue:             0,
//         });
//       }

//       // 3. BuyerOrder status
//       await BuyerOrder.findByIdAndUpdate(returnOrder.buyerOrderId, { status: "returned" });

//       // 4. Penalty 2% calculate
//       const penaltyAmount = returnOrder.penaltyAmount;
//       let   remainingPenalty = penaltyAmount;
//       const penaltyCutFrom   = [];
//       let   supplierDebtAdded = 0;

//       // Step 1: Same bulk order se cut karo (unpaid supplier invoices)
//       const sameBulkInvoices = await Invoice.find({
//         bulkOrderId:           returnOrder.bulkOrderId,
//         invoiceType:           "supplier",
//         supplierPaymentStatus: "pending",
//         _id:                   { $ne: supplierInvoice?._id },
//       }).sort({ createdAt: 1 });

//       for (const inv of sameBulkInvoices) {
//         if (remainingPenalty <= 0) break;
//         const cut = Math.min(remainingPenalty, inv.amountDue);
//         await Invoice.findByIdAndUpdate(inv._id, {
//           $inc: { amountDue: -cut, supplierDeduction: cut },
//         });
//         penaltyCutFrom.push({ bulkOrderId: returnOrder.bulkOrderId, amountCut: cut });
//         remainingPenalty -= cut;
//       }

//       // Step 2: Next pending bulk orders se cut karo
//       if (remainingPenalty > 0) {
//         const nextBulkInvoices = await Invoice.find({
//           supplierBranchId:      returnOrder.supplierBranchId,
//           invoiceType:           "supplier",
//           supplierPaymentStatus: "pending",
//           bulkOrderId:           { $ne: returnOrder.bulkOrderId },
//         }).sort({ createdAt: 1 });

//         for (const inv of nextBulkInvoices) {
//           if (remainingPenalty <= 0) break;
//           const cut = Math.min(remainingPenalty, inv.amountDue);
//           await Invoice.findByIdAndUpdate(inv._id, {
//             $inc: { amountDue: -cut, supplierDeduction: cut },
//           });
//           penaltyCutFrom.push({ bulkOrderId: inv.bulkOrderId, amountCut: cut });
//           remainingPenalty -= cut;
//         }
//       }

//       // Step 3: Remaining → SupplierDebt (negative balance)
//       if (remainingPenalty > 0) {
//         await SupplierDebt.create({
//           supplierBranchId: returnOrder.supplierBranchId,
//           returnOrderId:    returnOrder._id,
//           bulkOrderId:      returnOrder.bulkOrderId,
//           amount:           remainingPenalty,
//         });
//         supplierDebtAdded = remainingPenalty;
//       }

//       // 5. Return Delivery create (buyer → supplier)
//       const buyerBranch    = await Branch.findById(returnOrder.buyerBranchId);
//       const supplierBranch = await Branch.findById(returnOrder.supplierBranchId);

//       const returnDelivery = await ReturnDelivery.create({
//         returnOrderId:     returnOrder._id,
//         deliveryCompanyId: returnOrder.deliveryCompanyId,
//         buyerBranchId:     returnOrder.buyerBranchId,
//         supplierBranchId:  returnOrder.supplierBranchId,
//         pickupAddress: {
//           lat:     buyerBranch?.address?.lat,
//           lng:     buyerBranch?.address?.lng,
//           address: buyerBranch?.address?.address,
//         },
//         dropAddress: {
//           lat:     supplierBranch?.address?.lat,
//           lng:     supplierBranch?.address?.lng,
//           address: supplierBranch?.address?.address,
//         },
//       });

//       // 6. ReturnOrder update
//       await ReturnOrder.findByIdAndUpdate(returnOrder._id, {
//         status:            "resolved_supplier_guilty",
//         adminNote:         note || null,
//         adminResolvedAt:   now,
//         resolvedBy:        req.admin._id,
//         penaltyApplied:    true,
//         penaltyCutFrom,
//         supplierDebtAdded,
//       });

//       return res.json({
//         success: true,
//         message: `Supplier guilty. Penalty QAR ${penaltyAmount} applied. Return delivery created.`,
//         data: {
//           penaltyAmount,
//           penaltyCutFrom,
//           supplierDebtAdded,
//           returnDeliveryId: returnDelivery._id,
//         },
//       });
//     }

//     // ─── RIDER GUILTY ────────────────────────────────────
//     if (decision === "rider_guilty") {
//       // 1. Buyer invoice → paid_by_rider
//       await Invoice.findByIdAndUpdate(invoice._id, {
//         paymentStatus: "paid_by_rider",
//         amountPaid:    invoice.grandTotal,
//         amountDue:     0,
//       });

//       // 2. BuyerOrder → delivered (as normal)
//       await BuyerOrder.findByIdAndUpdate(returnOrder.buyerOrderId, { status: "delivered" });

//       // 3. Rider debt record
//       const riderShare = Math.round(invoice.grandTotal * 0.01 * 100) / 100;
//       const netOwed    = Math.round((invoice.grandTotal - riderShare) * 100) / 100;

//       await RiderDebt.create({
//         deliveryCompanyId: returnOrder.deliveryCompanyId,
//         returnOrderId:     returnOrder._id,
//         invoiceId:         invoice._id,
//         invoiceNumber:     invoice.invoiceNumber,
//         grandTotal:        invoice.grandTotal,
//         riderShare,
//         netOwed,
//       });

//       // 4. ReturnOrder update
//       await ReturnOrder.findByIdAndUpdate(returnOrder._id, {
//         status:            "resolved_rider_guilty",
//         adminNote:         note || null,
//         adminResolvedAt:   now,
//         resolvedBy:        req.admin._id,
//         riderDebtRecorded: true,
//         riderDebtAmount:   netOwed,
//       });

//       return res.json({
//         success: true,
//         message: `Rider guilty. Debt QAR ${netOwed} recorded for monthly settlement.`,
//         data: { grandTotal: invoice.grandTotal, riderShare, netOwed },
//       });
//     }
//   } catch (err) {
//     console.error("adminResolve error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  DELIVERY — Return Delivery Actions
// //  PUT /api/returns/delivery/:returnDeliveryId/pick
// //  PUT /api/returns/delivery/:returnDeliveryId/complete
// // ═══════════════════════════════════════════════════════
// exports.pickReturnDelivery = async (req, res) => {
//   try {
//     const rd = await ReturnDelivery.findOne({
//       _id:               req.params.returnDeliveryId,
//       deliveryCompanyId: req.deliveryCompany._id,
//       status:            "pending",
//     });

//     if (!rd) return res.status(404).json({ success: false, message: "Return delivery not found" });

//     await ReturnDelivery.findByIdAndUpdate(rd._id, {
//       status:   "picked",
//       pickedAt: new Date(),
//     });

//     res.json({ success: true, message: "Return delivery picked ✅" });
//   } catch (err) {
//     console.error("pickReturnDelivery error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// exports.completeReturnDelivery = async (req, res) => {
//   try {
//     const rd = await ReturnDelivery.findOne({
//       _id:               req.params.returnDeliveryId,
//       deliveryCompanyId: req.deliveryCompany._id,
//       status:            "picked",
//     });

//     if (!rd) return res.status(404).json({ success: false, message: "Return delivery not found" });

//     await ReturnDelivery.findByIdAndUpdate(rd._id, {
//       status:      "delivered_to_supplier",
//       deliveredAt: new Date(),
//     });

//     // BuyerOrder final status
//     const returnOrder = await ReturnOrder.findById(rd.returnOrderId);
//     if (returnOrder) {
//       await BuyerOrder.findByIdAndUpdate(returnOrder.buyerOrderId, { status: "returned" });
//     }

//     res.json({ success: true, message: "Return delivered to supplier ✅" });
//   } catch (err) {
//     console.error("completeReturnDelivery error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  ADMIN — Rider Debt Summary (monthly settlement)
// //  GET /api/returns/admin/rider-debts
// // ═══════════════════════════════════════════════════════
// exports.getRiderDebts = async (req, res) => {
//   try {
//     const { settled, deliveryCompanyId } = req.query;
//     const filter = {};
//     if (settled !== undefined) filter.settled = settled === "true";
//     if (deliveryCompanyId)     filter.deliveryCompanyId = deliveryCompanyId;

//     const debts = await RiderDebt.find(filter)
//       .populate("deliveryCompanyId", "name email phone")
//       .populate("invoiceId",         "invoiceNumber grandTotal")
//       .sort({ createdAt: -1 });

//     // Summary per company
//     const summary = {};
//     debts.forEach(d => {
//       const cid = d.deliveryCompanyId?._id?.toString();
//       if (!summary[cid]) {
//         summary[cid] = {
//           company:        d.deliveryCompanyId,
//           totalOwed:      0,
//           totalRiderShare: 0,
//           orderCount:     0,
//           settled:        0,
//           unsettled:      0,
//         };
//       }
//       summary[cid].totalOwed       += d.netOwed;
//       summary[cid].totalRiderShare += d.riderShare;
//       summary[cid].orderCount++;
//       if (d.settled) summary[cid].settled++;
//       else           summary[cid].unsettled++;
//     });

//     res.json({
//       success: true,
//       total:   debts.length,
//       summary: Object.values(summary),
//       data:    debts,
//     });
//   } catch (err) {
//     console.error("getRiderDebts error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  ADMIN — Mark Rider Debt Settled
// //  PUT /api/returns/admin/rider-debts/:id/settle
// // ═══════════════════════════════════════════════════════
// exports.settleRiderDebt = async (req, res) => {
//   try {
//     const { note } = req.body;
//     await RiderDebt.findByIdAndUpdate(req.params.id, {
//       settled:   true,
//       settledAt: new Date(),
//       note:      note || null,
//     });
//     res.json({ success: true, message: "Rider debt marked as settled ✅" });
//   } catch (err) {
//     console.error("settleRiderDebt error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  ADMIN — Supplier Debt Summary
// //  GET /api/returns/admin/supplier-debts
// // ═══════════════════════════════════════════════════════
// exports.getSupplierDebts = async (req, res) => {
//   try {
//     const { settled } = req.query;
//     const filter = {};
//     if (settled !== undefined) filter.settled = settled === "true";

//     const debts = await SupplierDebt.find(filter)
//       .populate("supplierBranchId", "managerName companyName email")
//       .populate("returnOrderId",    "subject status penaltyAmount")
//       .sort({ createdAt: -1 });

//     res.json({ success: true, total: debts.length, data: debts });
//   } catch (err) {
//     console.error("getSupplierDebts error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };


// 📁 controllers/returnOrderController.js
const ReturnOrder    = require("../models/returnOrder/ReturnOrder");
const ReturnDelivery = require("../models/returnOrder/ReturnDelivery");
const SupplierDebt   = require("../models/returnOrder/SupplierDebt");
const RiderDebt      = require("../models/returnOrder/RiderDebt");
const BuyerOrder     = require("../models/buyer/buyerOrder");
const BulkOrder      = require("../models/BulkOrder");
const Invoice        = require("../models/invoice");
const Branch         = require("../models/Branch");
const DeliveryOrder  = require("../models/riderCompany/orderDelivery");
const { getCommissionSettings } = require("../cron/commissionSettingService");
const { uploadToFirebase } = require("../config/uploadToFirebase");

// ═══════════════════════════════════════════════════════
//  BUYER — Submit Return Request
//  POST /api/returns/buyer/submit
//  Body: { buyerOrderId, subject, description }
//  Files: images (max 3)
// ═══════════════════════════════════════════════════════
exports.submitReturn = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can submit returns" });
    }

    const { buyerOrderId, subject, description } = req.body;

    if (!buyerOrderId || !subject || !description) {
      return res.status(400).json({ success: false, message: "buyerOrderId, subject, description required" });
    }

    const order = await BuyerOrder.findOne({
      _id:           buyerOrderId,
      buyerBranchId: req.branch._id,
      status:        "delivered",
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Delivered order not found" });
    }

    // 24hr window check
    const invoice = await Invoice.findOne({
      buyerOrderId: order._id,
      invoiceType:  "buyer",
    });

    if (!invoice?.deliveredAt) {
      return res.status(400).json({ success: false, message: "Delivery info not found" });
    }

    const hoursPassed = (Date.now() - new Date(invoice.deliveredAt).getTime()) / (1000 * 60 * 60);
    if (hoursPassed > 24) {
      return res.status(400).json({ success: false, message: "Return window closed — only within 24 hours of delivery" });
    }

    // Existing return check
    const existing = await ReturnOrder.findOne({ buyerOrderId: order._id });
    if (existing) {
      return res.status(400).json({ success: false, message: "Return request already submitted for this order" });
    }

    // Upload images
    const imageUrls = [];
    if (req.files?.length) {
      const maxImages = Math.min(req.files.length, 3);
      for (let i = 0; i < maxImages; i++) {
        const url = await uploadToFirebase(
          req.files[i].buffer,
          req.files[i].originalname,
          `return-images/${req.branch._id}`
        );
        imageUrls.push(url);
      }
    }

    // Get delivery company from DeliveryOrder
    const deliveryOrder = await DeliveryOrder.findOne({ bulkOrderId: order.bulkOrderId });

    // Get supplier invoice for amounts
    const supplierInvoice = await Invoice.findOne({
      buyerOrderId: order._id,
      invoiceType:  "supplier",
    });

    // ─── Penalty % DB se fetch karo ──────────────────
    const commSettings  = await getCommissionSettings();
    const PENALTY_PCT   = commSettings.supplierPenalty / 100;  // e.g. 0.02
    const penaltyAmount = Math.round((supplierInvoice?.grandTotal || 0) * PENALTY_PCT * 100) / 100;

    const returnOrder = await ReturnOrder.create({
      buyerOrderId:     order._id,
      bulkOrderId:      order.bulkOrderId,
      buyerBranchId:    req.branch._id,
      supplierBranchId: invoice.supplierBranchId,
      invoiceId:        invoice._id,
      deliveryOrderId:  deliveryOrder?._id || null,
      deliveryCompanyId: deliveryOrder?.deliveryCompanyId || null,
      subject,
      description,
      images: imageUrls,
      orderGrandTotal:  invoice.grandTotal,
      orderRawAmount:   invoice.totalAmount,
      deliveryCharge:   invoice.deliveryAmount,
      commissionAmount: invoice.commissionAmount,
      penaltyAmount,
    });

    // BuyerOrder status update
    await BuyerOrder.findByIdAndUpdate(order._id, { status: "return_requested" });

    res.status(201).json({
      success: true,
      message: "Return request submitted ✅",
      data: {
        returnOrderId: returnOrder._id,
        status:        returnOrder.status,
      },
    });
  } catch (err) {
    console.error("submitReturn error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  BUYER — Get My Return Orders
//  GET /api/returns/buyer/my-returns
// ═══════════════════════════════════════════════════════
exports.getMyReturns = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can access this" });
    }

    const returns = await ReturnOrder.find({ buyerBranchId: req.branch._id })
      .populate("buyerOrderId",  "quantity status")
      .populate("invoiceId",     "invoiceNumber grandTotal")
      .populate("bulkOrderId",   "platformItemId countryId")
      .sort({ createdAt: -1 });

    res.json({ success: true, total: returns.length, data: returns });
  } catch (err) {
    console.error("getMyReturns error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Get Return Requests
//  GET /api/returns/supplier/requests
// ═══════════════════════════════════════════════════════
exports.getSupplierReturns = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }

    const returns = await ReturnOrder.find({
      supplierBranchId: req.branch._id,
      status: { $in: ["pending", "supplier_accepted", "supplier_rejected"] },
    })
      .populate("buyerBranchId", "managerName companyName")
      .populate("invoiceId",     "invoiceNumber grandTotal totalAmount")
      .sort({ createdAt: -1 });

    res.json({ success: true, total: returns.length, data: returns });
  } catch (err) {
    console.error("getSupplierReturns error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Respond to Return
//  PUT /api/returns/supplier/:returnId/respond
//  Body: { action: "accept" | "reject", note }
// ═══════════════════════════════════════════════════════
exports.supplierRespond = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can respond" });
    }

    const { action, note } = req.body;
    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be accept or reject" });
    }
    if (action === "reject" && !note) {
      return res.status(400).json({ success: false, message: "Rejection reason required" });
    }

    const returnOrder = await ReturnOrder.findOne({
      _id:              req.params.returnId,
      supplierBranchId: req.branch._id,
      status:           "pending",
    });

    if (!returnOrder) {
      return res.status(404).json({ success: false, message: "Return request not found" });
    }

    await ReturnOrder.findByIdAndUpdate(returnOrder._id, {
      status:              action === "accept" ? "supplier_accepted" : "supplier_rejected",
      supplierNote:        note || null,
      supplierRespondedAt: new Date(),
    });

    res.json({
      success: true,
      message: action === "accept" ? "Return accepted" : "Return rejected",
    });
  } catch (err) {
    console.error("supplierRespond error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Get All Return Orders
//  GET /api/returns/admin/all?status=pending
// ═══════════════════════════════════════════════════════
exports.adminGetReturns = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await ReturnOrder.countDocuments(filter);

    const returns = await ReturnOrder.find(filter)
      .populate("buyerBranchId",    "managerName companyName email")
      .populate("supplierBranchId", "managerName companyName email")
      .populate("invoiceId",        "invoiceNumber grandTotal totalAmount deliveryAmount commissionAmount")
      .populate("bulkOrderId",      "winningPrice totalQuantity")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      total,
      page:  Number(page),
      pages: Math.ceil(total / Number(limit)),
      data:  returns,
    });
  } catch (err) {
    console.error("adminGetReturns error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Resolve Return Order
//  PUT /api/returns/admin/:returnId/resolve
//  Body: { decision: "cancel" | "supplier_guilty" | "rider_guilty", note }
// ═══════════════════════════════════════════════════════
exports.adminResolve = async (req, res) => {
  try {
    const { decision, note } = req.body;

    if (!["cancel", "supplier_guilty", "rider_guilty"].includes(decision)) {
      return res.status(400).json({ success: false, message: "Invalid decision" });
    }

    const returnOrder = await ReturnOrder.findById(req.params.returnId)
      .populate("invoiceId");

    if (!returnOrder) {
      return res.status(404).json({ success: false, message: "Return order not found" });
    }

    if (returnOrder.status.startsWith("resolved_")) {
      return res.status(400).json({ success: false, message: "Already resolved" });
    }

    const invoice = returnOrder.invoiceId;
    const now     = new Date();

    // ─── CANCEL ─────────────────────────────────────────
    if (decision === "cancel") {
      await ReturnOrder.findByIdAndUpdate(returnOrder._id, {
        status:         "resolved_cancelled",
        adminNote:      note || null,
        adminResolvedAt: now,
        resolvedBy:     req.admin._id,
      });

      // BuyerOrder wapas delivered
      await BuyerOrder.findByIdAndUpdate(returnOrder.buyerOrderId, { status: "delivered" });

      return res.json({ success: true, message: "Return request cancelled" });
    }

    // ─── SUPPLIER GUILTY ─────────────────────────────────
    if (decision === "supplier_guilty") {
      // 1. Buyer invoice cancel
      await Invoice.findByIdAndUpdate(invoice._id, {
        paymentStatus: "cancelled",
        amountDue:     0,
      });

      // 2. Supplier invoice cancel
      const supplierInvoice = await Invoice.findOne({
        buyerOrderId: returnOrder.buyerOrderId,
        invoiceType:  "supplier",
      });
      if (supplierInvoice) {
        await Invoice.findByIdAndUpdate(supplierInvoice._id, {
          supplierPaymentStatus: "deducted",
          amountDue:             0,
        });
      }

      // 3. BuyerOrder status
      await BuyerOrder.findByIdAndUpdate(returnOrder.buyerOrderId, { status: "returned" });

      // 4. Penalty 2% calculate
      const penaltyAmount = returnOrder.penaltyAmount;
      let   remainingPenalty = penaltyAmount;
      const penaltyCutFrom   = [];
      let   supplierDebtAdded = 0;

      // Step 1: Same bulk order se cut karo (unpaid supplier invoices)
      const sameBulkInvoices = await Invoice.find({
        bulkOrderId:           returnOrder.bulkOrderId,
        invoiceType:           "supplier",
        supplierPaymentStatus: "pending",
        _id:                   { $ne: supplierInvoice?._id },
      }).sort({ createdAt: 1 });

      for (const inv of sameBulkInvoices) {
        if (remainingPenalty <= 0) break;
        const cut = Math.min(remainingPenalty, inv.amountDue);
        await Invoice.findByIdAndUpdate(inv._id, {
          $inc: { amountDue: -cut, supplierDeduction: cut },
        });
        penaltyCutFrom.push({ bulkOrderId: returnOrder.bulkOrderId, amountCut: cut });
        remainingPenalty -= cut;
      }

      // Step 2: Next pending bulk orders se cut karo
      if (remainingPenalty > 0) {
        const nextBulkInvoices = await Invoice.find({
          supplierBranchId:      returnOrder.supplierBranchId,
          invoiceType:           "supplier",
          supplierPaymentStatus: "pending",
          bulkOrderId:           { $ne: returnOrder.bulkOrderId },
        }).sort({ createdAt: 1 });

        for (const inv of nextBulkInvoices) {
          if (remainingPenalty <= 0) break;
          const cut = Math.min(remainingPenalty, inv.amountDue);
          await Invoice.findByIdAndUpdate(inv._id, {
            $inc: { amountDue: -cut, supplierDeduction: cut },
          });
          penaltyCutFrom.push({ bulkOrderId: inv.bulkOrderId, amountCut: cut });
          remainingPenalty -= cut;
        }
      }

      // Step 3: Remaining → SupplierDebt (negative balance)
      if (remainingPenalty > 0) {
        await SupplierDebt.create({
          supplierBranchId: returnOrder.supplierBranchId,
          returnOrderId:    returnOrder._id,
          bulkOrderId:      returnOrder.bulkOrderId,
          amount:           remainingPenalty,
        });
        supplierDebtAdded = remainingPenalty;
      }

      // 5. Return Delivery create (buyer → supplier)
      const buyerBranch    = await Branch.findById(returnOrder.buyerBranchId);
      const supplierBranch = await Branch.findById(returnOrder.supplierBranchId);

      const returnDelivery = await ReturnDelivery.create({
        returnOrderId:     returnOrder._id,
        deliveryCompanyId: returnOrder.deliveryCompanyId,
        buyerBranchId:     returnOrder.buyerBranchId,
        supplierBranchId:  returnOrder.supplierBranchId,
        pickupAddress: {
          lat:     buyerBranch?.address?.lat,
          lng:     buyerBranch?.address?.lng,
          address: buyerBranch?.address?.address,
        },
        dropAddress: {
          lat:     supplierBranch?.address?.lat,
          lng:     supplierBranch?.address?.lng,
          address: supplierBranch?.address?.address,
        },
      });

      // 6. ReturnOrder update
      await ReturnOrder.findByIdAndUpdate(returnOrder._id, {
        status:            "resolved_supplier_guilty",
        adminNote:         note || null,
        adminResolvedAt:   now,
        resolvedBy:        req.admin._id,
        penaltyApplied:    true,
        penaltyCutFrom,
        supplierDebtAdded,
      });

      return res.json({
        success: true,
        message: `Supplier guilty. Penalty QAR ${penaltyAmount} applied. Return delivery created.`,
        data: {
          penaltyAmount,
          penaltyCutFrom,
          supplierDebtAdded,
          returnDeliveryId: returnDelivery._id,
        },
      });
    }

    // ─── RIDER GUILTY ────────────────────────────────────
    if (decision === "rider_guilty") {
      // 1. Buyer invoice → paid_by_rider
      await Invoice.findByIdAndUpdate(invoice._id, {
        paymentStatus: "paid_by_rider",
        amountPaid:    invoice.grandTotal,
        amountDue:     0,
      });

      // 2. BuyerOrder → delivered (as normal)
      await BuyerOrder.findByIdAndUpdate(returnOrder.buyerOrderId, { status: "delivered" });

      // 3. Rider debt record
      const riderShare = Math.round(invoice.grandTotal * 0.01 * 100) / 100;
      const netOwed    = Math.round((invoice.grandTotal - riderShare) * 100) / 100;

      await RiderDebt.create({
        deliveryCompanyId: returnOrder.deliveryCompanyId,
        returnOrderId:     returnOrder._id,
        invoiceId:         invoice._id,
        invoiceNumber:     invoice.invoiceNumber,
        grandTotal:        invoice.grandTotal,
        riderShare,
        netOwed,
      });

      // 4. ReturnOrder update
      await ReturnOrder.findByIdAndUpdate(returnOrder._id, {
        status:            "resolved_rider_guilty",
        adminNote:         note || null,
        adminResolvedAt:   now,
        resolvedBy:        req.admin._id,
        riderDebtRecorded: true,
        riderDebtAmount:   netOwed,
      });

      return res.json({
        success: true,
        message: `Rider guilty. Debt QAR ${netOwed} recorded for monthly settlement.`,
        data: { grandTotal: invoice.grandTotal, riderShare, netOwed },
      });
    }
  } catch (err) {
    console.error("adminResolve error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  DELIVERY — Return Delivery Actions
//  PUT /api/returns/delivery/:returnDeliveryId/pick
//  PUT /api/returns/delivery/:returnDeliveryId/complete
// ═══════════════════════════════════════════════════════
exports.pickReturnDelivery = async (req, res) => {
  try {
    const rd = await ReturnDelivery.findOne({
      _id:               req.params.returnDeliveryId,
      deliveryCompanyId: req.deliveryCompany._id,
      status:            "pending",
    });

    if (!rd) return res.status(404).json({ success: false, message: "Return delivery not found" });

    await ReturnDelivery.findByIdAndUpdate(rd._id, {
      status:   "picked",
      pickedAt: new Date(),
    });

    res.json({ success: true, message: "Return delivery picked ✅" });
  } catch (err) {
    console.error("pickReturnDelivery error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.completeReturnDelivery = async (req, res) => {
  try {
    const rd = await ReturnDelivery.findOne({
      _id:               req.params.returnDeliveryId,
      deliveryCompanyId: req.deliveryCompany._id,
      status:            "picked",
    });

    if (!rd) return res.status(404).json({ success: false, message: "Return delivery not found" });

    await ReturnDelivery.findByIdAndUpdate(rd._id, {
      status:      "delivered_to_supplier",
      deliveredAt: new Date(),
    });

    // BuyerOrder final status
    const returnOrder = await ReturnOrder.findById(rd.returnOrderId);
    if (returnOrder) {
      await BuyerOrder.findByIdAndUpdate(returnOrder.buyerOrderId, { status: "returned" });
    }

    res.json({ success: true, message: "Return delivered to supplier ✅" });
  } catch (err) {
    console.error("completeReturnDelivery error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Rider Debt Summary (monthly settlement)
//  GET /api/returns/admin/rider-debts
// ═══════════════════════════════════════════════════════
exports.getRiderDebts = async (req, res) => {
  try {
    const { settled, deliveryCompanyId } = req.query;
    const filter = {};
    if (settled !== undefined) filter.settled = settled === "true";
    if (deliveryCompanyId)     filter.deliveryCompanyId = deliveryCompanyId;

    const debts = await RiderDebt.find(filter)
      .populate("deliveryCompanyId", "name email phone")
      .populate("invoiceId",         "invoiceNumber grandTotal")
      .sort({ createdAt: -1 });

    // Summary per company
    const summary = {};
    debts.forEach(d => {
      const cid = d.deliveryCompanyId?._id?.toString();
      if (!summary[cid]) {
        summary[cid] = {
          company:        d.deliveryCompanyId,
          totalOwed:      0,
          totalRiderShare: 0,
          orderCount:     0,
          settled:        0,
          unsettled:      0,
        };
      }
      summary[cid].totalOwed       += d.netOwed;
      summary[cid].totalRiderShare += d.riderShare;
      summary[cid].orderCount++;
      if (d.settled) summary[cid].settled++;
      else           summary[cid].unsettled++;
    });

    res.json({
      success: true,
      total:   debts.length,
      summary: Object.values(summary),
      data:    debts,
    });
  } catch (err) {
    console.error("getRiderDebts error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Mark Rider Debt Settled
//  PUT /api/returns/admin/rider-debts/:id/settle
// ═══════════════════════════════════════════════════════
exports.settleRiderDebt = async (req, res) => {
  try {
    const { note } = req.body;
    await RiderDebt.findByIdAndUpdate(req.params.id, {
      settled:   true,
      settledAt: new Date(),
      note:      note || null,
    });
    res.json({ success: true, message: "Rider debt marked as settled ✅" });
  } catch (err) {
    console.error("settleRiderDebt error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Supplier Debt Summary
//  GET /api/returns/admin/supplier-debts
// ═══════════════════════════════════════════════════════
exports.getSupplierDebts = async (req, res) => {
  try {
    const { settled } = req.query;
    const filter = {};
    if (settled !== undefined) filter.settled = settled === "true";

    const debts = await SupplierDebt.find(filter)
      .populate("supplierBranchId", "managerName companyName email")
      .populate("returnOrderId",    "subject status penaltyAmount")
      .sort({ createdAt: -1 });

    res.json({ success: true, total: debts.length, data: debts });
  } catch (err) {
    console.error("getSupplierDebts error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};