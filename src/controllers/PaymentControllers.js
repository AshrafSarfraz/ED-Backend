// 📁 controllers/PaymentController.js
const mongoose       = require("mongoose");
const Invoice        = require("../models/invoice");
const PaymentReceipt = require("../models/Payment");
const Branch         = require("../models/Branch");
const { uploadToFirebase } = require("../config/uploadToFirebase");

// Jin statuses par buyer se paisa aana baaki hai
const PAYABLE = ["unpaid", "partial", "overdue"];

exports.getPaymentDashboard = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can access this" });
    }

    const invoices = await Invoice.find({
      buyerBranchId: req.branch._id,
      invoiceType:   "buyer",
    })
      .populate("platformItemId", "name image unit")
      .populate("countryId",      "name")
      .populate("bulkOrderId",    "winningPrice totalQuantity")
      .sort({ createdAt: -1 });

    let totalDue = 0, totalPaid = 0, totalOverdue = 0, totalAwaiting = 0;
    const now = new Date();

    invoices.forEach((inv) => {
      if (inv.paymentStatus === "paid") {
        totalPaid += inv.grandTotal;
      } else {
        totalDue += inv.amountDue;
        if (now > new Date(inv.dueDate)) totalOverdue += inv.amountDue;
        // Jo invoices admin ke approval ka intezar kar rahi hain
        if (inv.pendingReceiptId) totalAwaiting += inv.amountDue;
      }
    });

    const grouped = {};
    invoices.forEach((inv) => {
      const dateKey = new Date(inv.createdAt).toISOString().slice(0, 10);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push({
        invoiceId:      inv._id,
        invoiceNumber:  inv.invoiceNumber,
        item:           inv.platformItemId?.name,
        image:          inv.platformItemId?.image,
        unit:           inv.platformItemId?.unit,
        country:        inv.countryId?.name,
        quantity:       inv.quantity,
        pricePerUnit:   inv.pricePerUnit,
        grandTotal:     inv.grandTotal,
        amountDue:      inv.amountDue,
        amountPaid:     inv.amountPaid,
        paymentStatus:  inv.paymentStatus,
        dueDate:        inv.dueDate,
        deliveryStatus: inv.deliveryStatus,
        isOverdue:      now > new Date(inv.dueDate) && !["paid", "cancelled"].includes(inv.paymentStatus),

        // ─── App ke liye — is invoice ka receipt already submit ho chuka hai? ───
        // App is flag par row disable karti hai, warna buyer dobara select
        // kar leta hai aur duplicate receipt ban jaati hai.
        hasPendingReceipt: !!inv.pendingReceiptId,
        pendingReceiptId:  inv.pendingReceiptId || null,
        // Selectable = payable hai AUR koi receipt pending nahi
        isSelectable:      PAYABLE.includes(inv.paymentStatus) && !inv.pendingReceiptId,
      });
    });

    const pendingReceipts = await PaymentReceipt.find({
      buyerBranchId: req.branch._id,
      status:        "pending",
    }).select("totalAmount invoiceIds createdAt status");

    res.json({
      success: true,
      data: {
        summary: {
          totalDue:      Math.round(totalDue      * 100) / 100,
          totalPaid:     Math.round(totalPaid     * 100) / 100,
          totalOverdue:  Math.round(totalOverdue  * 100) / 100,
          // Submit ho chuka, admin approval ka intezar
          totalAwaiting: Math.round(totalAwaiting * 100) / 100,
          totalInvoices: invoices.length,
          unpaidCount:   invoices.filter((i) => !["paid", "cancelled"].includes(i.paymentStatus)).length,
          awaitingCount: invoices.filter((i) => !!i.pendingReceiptId).length,
        },
        pendingReceipts,
        invoicesByDate: grouped,
      },
    });
  } catch (err) {
    console.error("getPaymentDashboard error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  BUYER — Submit Receipt
//
//  Duplicate submission ka fix yahan hai. Pehle sirf
//  paymentStatus != "paid" check hota tha — magar pending receipt
//  paymentStatus badalta hi nahi (woh approve par badalta hai),
//  is liye buyer same invoice bar bar submit kar sakta tha.
//
//  Ab teen cheezein hoti hain:
//    1. invoiceIds dedupe
//    2. Atomic claim — sirf woh invoices lock hongi jo free + payable hain.
//       Agar poori list lock na ho saki → 409, kuch bhi create nahi hota.
//    3. Koi bhi error aaye (upload / create) → lock wapas khul jaati hai
// ═══════════════════════════════════════════════════════
exports.submitReceipt = async (req, res) => {
  // catch block ko in dono ki zaroorat hai, is liye try se bahar
  let receiptId = null;
  let claimed   = false;

  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can access this" });
    }

    const { invoiceIds, totalAmount, note } = req.body;
    if (!invoiceIds || !totalAmount) {
      return res.status(400).json({ success: false, message: "invoiceIds and totalAmount are required" });
    }

    // ── Parse + dedupe ────────────────────────────────
    let rawIds;
    try {
      rawIds = Array.isArray(invoiceIds) ? invoiceIds : JSON.parse(invoiceIds);
    } catch {
      return res.status(400).json({ success: false, message: "invoiceIds must be a valid array" });
    }

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({ success: false, message: "invoiceIds must be a non-empty array" });
    }

    // Same id do baar aa gaya to modifiedCount kam aayega aur ghalat 409 milega
    const ids = [...new Set(rawIds.map(String))];

    if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ success: false, message: "One or more invoiceIds are invalid" });
    }

    // ── Receipt ka _id pehle bana lo ──────────────────
    // Lock isi id se lagegi, taake rollback sirf apni lock kholay
    receiptId = new mongoose.Types.ObjectId();

    // ── ATOMIC CLAIM ──────────────────────────────────
    // Ek hi updateMany me lock lagti hai. Do parallel requests me se
    // sirf ek jeetegi — doosri ko modifiedCount kam milega → 409.
    const claim = await Invoice.updateMany(
      {
        _id:              { $in: ids },
        buyerBranchId:    req.branch._id,
        invoiceType:      "buyer",
        paymentStatus:    { $in: PAYABLE },
        pendingReceiptId: null,            // ← yahi asli guard hai
      },
      { $set: { pendingReceiptId: receiptId } }
    );

    if (claim.modifiedCount > 0) claimed = true;

    // ── Poori list lock nahi hui → 409, kuch create nahi karna ──
    if (claim.modifiedCount !== ids.length) {
      if (claimed) {
        await Invoice.updateMany(
          { pendingReceiptId: receiptId },
          { $set: { pendingReceiptId: null } }
        );
      }

      // Buyer ko batao kaunsi invoice ne roka
      const blocked = await Invoice.find({
        _id:         { $in: ids },
        invoiceType: "buyer",
        $or: [
          { pendingReceiptId: { $ne: null } },
          { paymentStatus:    { $nin: PAYABLE } },
        ],
      }).select("invoiceNumber paymentStatus pendingReceiptId");

      return res.status(409).json({
        success: false,
        code:    "ALREADY_SUBMITTED",
        message: blocked.length
          ? "Some invoices already have a payment awaiting approval, or are already paid."
          : "These invoices are no longer available for payment.",
        invoices: blocked.map((b) => ({
          invoiceId:     b._id,
          invoiceNumber: b.invoiceNumber,
          paymentStatus: b.paymentStatus,
          reason: b.pendingReceiptId ? "awaiting_approval" : b.paymentStatus,
        })),
      });
    }

    // ── Ab safe hai — upload karo ─────────────────────
    // Upload claim ke BAAD ho raha hai, jaan boojh kar: agar duplicate
    // submission hai to Firebase par orphan file nahi banti.
    let receiptImageUrl = null;
    if (req.file) {
      receiptImageUrl = await uploadToFirebase(
        req.file.buffer, req.file.originalname,
        `payment-receipts/${req.branch._id}`
      );
    }

    const receipt = await PaymentReceipt.create({
      _id:            receiptId,     // ← wahi id jo lock me daali thi
      buyerBranchId:  req.branch._id,
      buyerCompanyId: req.branch.companyId,
      invoiceIds:     ids,
      totalAmount:    Number(totalAmount),
      receiptImage:   receiptImageUrl,
      note:           note || null,
      status:         "pending",
    });

    res.status(201).json({
      success: true,
      message: "Payment receipt submitted. Admin will verify and approve ✅",
      data: {
        receiptId:    receipt._id,
        totalAmount:  receipt.totalAmount,
        invoiceCount: ids.length,
        status:       receipt.status,
      },
    });
  } catch (err) {
    console.error("submitReceipt error:", err);

    // ── Rollback ────────────────────────────────────────
    // Upload ya create fail hua to invoices lock me phansi nahi rehni chahiye,
    // warna buyer kabhi dobara submit nahi kar payega.
    if (claimed && receiptId) {
      try {
        await Invoice.updateMany(
          { pendingReceiptId: receiptId },
          { $set: { pendingReceiptId: null } }
        );
      } catch (rollbackErr) {
        // Ye serious hai — invoices stuck reh jayengi. Log zaroor karo.
        console.error("submitReceipt ROLLBACK FAILED — stuck invoices for receipt", receiptId, rollbackErr);
      }
    }

    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getMyReceipts = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can access this" });
    }
    const receipts = await PaymentReceipt.find({ buyerBranchId: req.branch._id })
      .populate("invoiceIds", "invoiceNumber grandTotal amountDue paymentStatus")
      .sort({ createdAt: -1 });
    res.json({ success: true, total: receipts.length, data: receipts });
  } catch (err) {
    console.error("getMyReceipts error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.adminGetReceipts = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await PaymentReceipt.countDocuments(filter);

    const receipts = await PaymentReceipt.find(filter)
      .populate("buyerBranchId",  "managerName email phone companyName")
      .populate("buyerCompanyId", "brandName")
      .populate("invoiceIds",     "invoiceNumber grandTotal amountDue paymentStatus")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / Number(limit)), data: receipts });
  } catch (err) {
    console.error("adminGetReceipts error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Approve Receipt
//  Buyer invoice → paid + lock release
//  Supplier invoice → paid_by_buyer (admin manually release karega baad mein)
// ═══════════════════════════════════════════════════════
exports.approveReceipt = async (req, res) => {
  try {
    const { adminNote } = req.body;

    const receipt = await PaymentReceipt.findById(req.params.receiptId);
    if (!receipt) return res.status(404).json({ success: false, message: "Receipt not found" });
    if (receipt.status !== "pending") return res.status(400).json({ success: false, message: "Receipt already processed" });

    const buyerInvoices = await Invoice.find({
      _id:         { $in: receipt.invoiceIds },
      invoiceType: "buyer",
    });

    for (const inv of buyerInvoices) {
      // Buyer invoice → paid. Lock bhi saath hi khol do —
      // ab paymentStatus "paid" hai, is liye claim query khud rok degi.
      await Invoice.findByIdAndUpdate(inv._id, {
        paymentStatus:    "paid",
        amountPaid:       inv.grandTotal,
        amountDue:        0,
        pendingReceiptId: null,
      });

      // Supplier invoice → paid_by_buyer (NOT released yet)
      const supplierInv = await Invoice.findOne({
        buyerOrderId: inv.buyerOrderId,
        invoiceType:  "supplier",
      });

      if (supplierInv && supplierInv.supplierPaymentStatus === "pending") {
        await Invoice.findByIdAndUpdate(supplierInv._id, {
          supplierPaymentStatus: "paid_by_buyer",
        });
      }
    }

    // Safety net — agar kisi invoice par lock reh gayi ho
    await Invoice.updateMany(
      { pendingReceiptId: receipt._id },
      { $set: { pendingReceiptId: null } }
    );

    await PaymentReceipt.findByIdAndUpdate(receipt._id, {
      status:            "approved",
      approvedBy:        req.admin._id,
      approvedAt:        new Date(),
      adminNote:         adminNote || null,
      suppliersReleased: 0,
      totalReleased:     0,
    });

    res.json({
      success: true,
      message: "Payment approved ✅ Buyer invoices paid. Supplier payment pending admin release.",
      data: { invoiceCount: buyerInvoices.length },
    });
  } catch (err) {
    console.error("approveReceipt error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Reject Receipt
//  Lock khul jaati hai → buyer dobara sahi receipt submit kar sakta hai.
//  paymentStatus ko chhua nahi jata (woh "unpaid" hi tha).
// ═══════════════════════════════════════════════════════
exports.rejectReceipt = async (req, res) => {
  try {
    const { adminNote } = req.body;
    if (!adminNote) return res.status(400).json({ success: false, message: "Rejection reason required" });

    const receipt = await PaymentReceipt.findById(req.params.receiptId);
    if (!receipt) return res.status(404).json({ success: false, message: "Receipt not found" });
    if (receipt.status !== "pending") return res.status(400).json({ success: false, message: "Receipt already processed" });

    // ── Lock release — ye line hi buyer ko resubmit karne deti hai ──
    const released = await Invoice.updateMany(
      { pendingReceiptId: receipt._id },
      { $set: { pendingReceiptId: null } }
    );

    await PaymentReceipt.findByIdAndUpdate(receipt._id, {
      status:     "rejected",
      approvedBy: req.admin._id,
      approvedAt: new Date(),
      adminNote,
    });

    res.json({
      success: true,
      message: "Receipt rejected. Buyer can submit a new receipt for these invoices.",
      data: { invoicesUnlocked: released.modifiedCount },
    });
  } catch (err) {
    console.error("rejectReceipt error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.adminBuyerSummary = async (req, res) => {
  try {
    const summary = await Invoice.aggregate([
      { $match: { invoiceType: "buyer" } },
      {
        $group: {
          _id:          "$buyerBranchId",
          totalBilled:  { $sum: "$grandTotal" },
          totalPaid:    { $sum: "$amountPaid" },
          totalDue:     { $sum: "$amountDue" },
          invoiceCount: { $sum: 1 },
          unpaidCount:  { $sum: { $cond: [{ $ne: ["$paymentStatus", "paid"] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: "branches", localField: "_id", foreignField: "_id", as: "branch",
        },
      },
      { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } }, // ← FIXED
      {
        $project: {
          branchId:    "$_id",
          managerName: "$branch.managerName",
          companyName: "$branch.companyName",
          email:       "$branch.email",
          phone:       "$branch.phone",
          totalBilled: { $round: ["$totalBilled", 2] },
          totalPaid:   { $round: ["$totalPaid",   2] },
          totalDue:    { $round: ["$totalDue",    2] },
          invoiceCount: 1,
          unpaidCount:  1,
        },
      },
      { $sort: { totalDue: -1 } },
    ]);

    res.json({ success: true, total: summary.length, data: summary });
  } catch (err) {
    console.error("adminBuyerSummary error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.supplierPaymentSummary = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }

    const LedgerEntry = require("../models/ledger/LedgerEntry");

    const invoices = await Invoice.find({
      supplierBranchId: req.branch._id,
      invoiceType:      "supplier",
    })
      .populate("platformItemId", "name image unit")
      .populate("countryId",      "name")
      .populate("bulkOrderId",    "totalQuantity winningPrice status isLate lateReason")
      .populate("buyerBranchId",  "managerName companyName")
      .sort({ createdAt: -1 })
      .lean();

    const invoiceIds = invoices.map(i => i._id);
    const entries = await LedgerEntry.find({
      entityType: "supplier", entityId: req.branch._id, invoiceId: { $in: invoiceIds },
    }).lean();

    // Net (credit - debit) + settled status per invoice
    const perInvoice = {};
    entries.forEach(e => {
      const id = e.invoiceId.toString();
      if (!perInvoice[id]) perInvoice[id] = { net: 0, allSettled: true };
      perInvoice[id].net += e.direction === "credit" ? e.amount : -e.amount;
      if (!e.settled) perInvoice[id].allSettled = false;
    });

    const bulkMap = {};

    invoices.forEach((inv) => {
      const bulkId = inv.bulkOrderId?._id?.toString() || "unknown";

      if (!bulkMap[bulkId]) {
        bulkMap[bulkId] = {
          bulkOrderId:   inv.bulkOrderId?._id,
          orderNumber:   `#ORD-${bulkId.slice(-6).toUpperCase()}`,
          item:          inv.platformItemId?.name,
          image:         inv.platformItemId?.image,
          country:       inv.countryId?.name,
          unit:          inv.platformItemId?.unit,
          totalQuantity: inv.bulkOrderId?.totalQuantity,
          winningPrice:  inv.bulkOrderId?.winningPrice,
          isLate:        inv.bulkOrderId?.isLate || false,
          lateReason:    inv.bulkOrderId?.lateReason || null,
          createdAt:     inv.createdAt,
          buyers:        [],
          totalEarning:  0,
          totalReleased: 0,
          totalPending:  0,
        };
      }

      const agg      = perInvoice[inv._id.toString()] || { net: 0, allSettled: false };
      const amount   = Math.round(agg.net * 100) / 100;
      const released = agg.allSettled && agg.net !== 0;

      bulkMap[bulkId].buyers.push({
        buyerName: inv.buyerBranchId?.managerName,
        quantity:  inv.quantity,
        amount,
        released,
      });

      bulkMap[bulkId].totalEarning += amount;
      if (released) bulkMap[bulkId].totalReleased += amount;
      else          bulkMap[bulkId].totalPending  += amount;
    });

    const result = Object.values(bulkMap).map((b) => ({
      ...b,
      totalEarning:  Math.round(b.totalEarning  * 100) / 100,
      totalReleased: Math.round(b.totalReleased * 100) / 100,
      totalPending:  Math.round(b.totalPending  * 100) / 100,
      buyersCount:   b.buyers.length,
      paidCount:     b.buyers.filter((x) => x.released).length,
    }));

    const overall = {
      totalEarning:  Math.round(result.reduce((s, r) => s + r.totalEarning,  0) * 100) / 100,
      totalReleased: Math.round(result.reduce((s, r) => s + r.totalReleased, 0) * 100) / 100,
      totalPending:  Math.round(result.reduce((s, r) => s + r.totalPending,  0) * 100) / 100,
    };

    res.json({ success: true, overall, total: result.length, data: result });
  } catch (err) {
    console.error("supplierPaymentSummary error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};























// // 📁 controllers/PaymentController.js
// const Invoice        = require("../models/invoice");
// const PaymentReceipt = require("../models/Payment");
// const Branch         = require("../models/Branch");
// const { uploadToFirebase } = require("../config/uploadToFirebase");

// exports.getPaymentDashboard = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Buyer") {
//       return res.status(403).json({ success: false, message: "Only buyers can access this" });
//     }

//     const invoices = await Invoice.find({
//       buyerBranchId: req.branch._id,
//       invoiceType:   "buyer",
//     })
//       .populate("platformItemId", "name image unit")
//       .populate("countryId",      "name")
//       .populate("bulkOrderId",    "winningPrice totalQuantity")
//       .sort({ createdAt: -1 });

//     let totalDue = 0, totalPaid = 0, totalOverdue = 0;
//     const now = new Date();

//     invoices.forEach((inv) => {
//       if (inv.paymentStatus === "paid") {
//         totalPaid += inv.grandTotal;
//       } else {
//         totalDue += inv.amountDue;
//         if (now > new Date(inv.dueDate)) totalOverdue += inv.amountDue;
//       }
//     });

//     const grouped = {};
//     invoices.forEach((inv) => {
//       const dateKey = new Date(inv.createdAt).toISOString().slice(0, 10);
//       if (!grouped[dateKey]) grouped[dateKey] = [];
//       grouped[dateKey].push({
//         invoiceId:      inv._id,
//         invoiceNumber:  inv.invoiceNumber,
//         item:           inv.platformItemId?.name,
//         image:          inv.platformItemId?.image,
//         unit:           inv.platformItemId?.unit,
//         country:        inv.countryId?.name,
//         quantity:       inv.quantity,
//         pricePerUnit:   inv.pricePerUnit,
//         grandTotal:     inv.grandTotal,
//         amountDue:      inv.amountDue,
//         amountPaid:     inv.amountPaid,
//         paymentStatus:  inv.paymentStatus,
//         dueDate:        inv.dueDate,
//         deliveryStatus: inv.deliveryStatus,
//         isOverdue:      now > new Date(inv.dueDate) && !["paid", "cancelled"].includes(inv.paymentStatus),
//       });
//     });

//     const pendingReceipts = await PaymentReceipt.find({
//       buyerBranchId: req.branch._id,
//       status:        "pending",
//     }).select("totalAmount invoiceIds createdAt status");

//     res.json({
//       success: true,
//       data: {
//         summary: {
//           totalDue:      Math.round(totalDue     * 100) / 100,
//           totalPaid:     Math.round(totalPaid    * 100) / 100,
//           totalOverdue:  Math.round(totalOverdue * 100) / 100,
//           totalInvoices: invoices.length,
//           unpaidCount:   invoices.filter((i) => !["paid", "cancelled"].includes(i.paymentStatus)).length,
//         },
//         pendingReceipts,
//         invoicesByDate: grouped,
//       },
//     });
//   } catch (err) {
//     console.error("getPaymentDashboard error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// exports.submitReceipt = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Buyer") {
//       return res.status(403).json({ success: false, message: "Only buyers can access this" });
//     }

//     const { invoiceIds, totalAmount, note } = req.body;
//     if (!invoiceIds || !totalAmount) {
//       return res.status(400).json({ success: false, message: "invoiceIds and totalAmount are required" });
//     }

//     const ids = Array.isArray(invoiceIds) ? invoiceIds : JSON.parse(invoiceIds);

//     const invoices = await Invoice.find({
//       _id:           { $in: ids },
//       buyerBranchId: req.branch._id,
//       invoiceType:   "buyer",
//       paymentStatus: { $ne: "paid" },
//     });

//     if (invoices.length === 0) {
//       return res.status(400).json({ success: false, message: "No valid unpaid invoices found" });
//     }

//     let receiptImageUrl = null;
//     if (req.file) {
//       receiptImageUrl = await uploadToFirebase(
//         req.file.buffer, req.file.originalname,
//         `payment-receipts/${req.branch._id}`
//       );
//     }

//     const receipt = await PaymentReceipt.create({
//       buyerBranchId:  req.branch._id,
//       buyerCompanyId: req.branch.companyId,
//       invoiceIds:     ids,
//       totalAmount:    Number(totalAmount),
//       receiptImage:   receiptImageUrl,
//       note:           note || null,
//       status:         "pending",
//     });

//     res.status(201).json({
//       success: true,
//       message: "Payment receipt submitted. Admin will verify and approve ✅",
//       data: { receiptId: receipt._id, totalAmount: receipt.totalAmount, invoiceCount: ids.length, status: receipt.status },
//     });
//   } catch (err) {
//     console.error("submitReceipt error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// exports.getMyReceipts = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Buyer") {
//       return res.status(403).json({ success: false, message: "Only buyers can access this" });
//     }
//     const receipts = await PaymentReceipt.find({ buyerBranchId: req.branch._id })
//       .populate("invoiceIds", "invoiceNumber grandTotal amountDue paymentStatus")
//       .sort({ createdAt: -1 });
//     res.json({ success: true, total: receipts.length, data: receipts });
//   } catch (err) {
//     console.error("getMyReceipts error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// exports.adminGetReceipts = async (req, res) => {
//   try {
//     const { status, page = 1, limit = 20 } = req.query;
//     const filter = {};
//     if (status) filter.status = status;

//     const skip  = (Number(page) - 1) * Number(limit);
//     const total = await PaymentReceipt.countDocuments(filter);

//     const receipts = await PaymentReceipt.find(filter)
//       .populate("buyerBranchId",  "managerName email phone companyName")
//       .populate("buyerCompanyId", "brandName")
//       .populate("invoiceIds",     "invoiceNumber grandTotal amountDue paymentStatus")
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(Number(limit));

//     res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / Number(limit)), data: receipts });
//   } catch (err) {
//     console.error("adminGetReceipts error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  ADMIN — Approve Receipt
// //  Buyer invoice → paid
// //  Supplier invoice → paid_by_buyer (admin manually release karega baad mein)
// // ═══════════════════════════════════════════════════════
// exports.approveReceipt = async (req, res) => {
//   try {
//     const { adminNote } = req.body;

//     const receipt = await PaymentReceipt.findById(req.params.receiptId);
//     if (!receipt) return res.status(404).json({ success: false, message: "Receipt not found" });
//     if (receipt.status !== "pending") return res.status(400).json({ success: false, message: "Receipt already processed" });

//     const buyerInvoices = await Invoice.find({
//       _id:         { $in: receipt.invoiceIds },
//       invoiceType: "buyer",
//     });

//     for (const inv of buyerInvoices) {
//       // Buyer invoice → paid
//       await Invoice.findByIdAndUpdate(inv._id, {
//         paymentStatus: "paid",
//         amountPaid:    inv.grandTotal,
//         amountDue:     0,
//       });

//       // Supplier invoice → paid_by_buyer (NOT released yet)
//       const supplierInv = await Invoice.findOne({
//         buyerOrderId: inv.buyerOrderId,
//         invoiceType:  "supplier",
//       });

//       if (supplierInv && supplierInv.supplierPaymentStatus === "pending") {
//         await Invoice.findByIdAndUpdate(supplierInv._id, {
//           supplierPaymentStatus: "paid_by_buyer",
//         });
//       }
//     }

//     await PaymentReceipt.findByIdAndUpdate(receipt._id, {
//       status:            "approved",
//       approvedBy:        req.admin._id,
//       approvedAt:        new Date(),
//       adminNote:         adminNote || null,
//       suppliersReleased: 0,
//       totalReleased:     0,
//     });

//     res.json({
//       success: true,
//       message: "Payment approved ✅ Buyer invoices paid. Supplier payment pending admin release.",
//       data: { invoiceCount: buyerInvoices.length },
//     });
//   } catch (err) {
//     console.error("approveReceipt error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// exports.rejectReceipt = async (req, res) => {
//   try {
//     const { adminNote } = req.body;
//     if (!adminNote) return res.status(400).json({ success: false, message: "Rejection reason required" });

//     const receipt = await PaymentReceipt.findById(req.params.receiptId);
//     if (!receipt) return res.status(404).json({ success: false, message: "Receipt not found" });
//     if (receipt.status !== "pending") return res.status(400).json({ success: false, message: "Receipt already processed" });

//     await PaymentReceipt.findByIdAndUpdate(receipt._id, {
//       status:     "rejected",
//       approvedBy: req.admin._id,
//       approvedAt: new Date(),
//       adminNote,
//     });

//     res.json({ success: true, message: "Receipt rejected." });
//   } catch (err) {
//     console.error("rejectReceipt error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// exports.adminBuyerSummary = async (req, res) => {
//   try {
//     const summary = await Invoice.aggregate([
//       { $match: { invoiceType: "buyer" } },
//       {
//         $group: {
//           _id:          "$buyerBranchId",
//           totalBilled:  { $sum: "$grandTotal" },
//           totalPaid:    { $sum: "$amountPaid" },
//           totalDue:     { $sum: "$amountDue" },
//           invoiceCount: { $sum: 1 },
//           unpaidCount:  { $sum: { $cond: [{ $ne: ["$paymentStatus", "paid"] }, 1, 0] } },
//         },
//       },
//       {
//         $lookup: {
//           from: "branches", localField: "_id", foreignField: "_id", as: "branch",
//         },
//       },
//       { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } }, // ← FIXED
//       {
//         $project: {
//           branchId:    "$_id",
//           managerName: "$branch.managerName",
//           companyName: "$branch.companyName",
//           email:       "$branch.email",
//           phone:       "$branch.phone",
//           totalBilled: { $round: ["$totalBilled", 2] },
//           totalPaid:   { $round: ["$totalPaid",   2] },
//           totalDue:    { $round: ["$totalDue",    2] },
//           invoiceCount: 1,
//           unpaidCount:  1,
//         },
//       },
//       { $sort: { totalDue: -1 } },
//     ]);

//     res.json({ success: true, total: summary.length, data: summary });
//   } catch (err) {
//     console.error("adminBuyerSummary error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// exports.supplierPaymentSummary = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Supplier") {
//       return res.status(403).json({ success: false, message: "Only suppliers can access this" });
//     }

//     const LedgerEntry = require("../models/ledger/LedgerEntry");

//     const invoices = await Invoice.find({
//       supplierBranchId: req.branch._id,
//       invoiceType:      "supplier",
//     })
//       .populate("platformItemId", "name image unit")
//       .populate("countryId",      "name")
//       .populate("bulkOrderId",    "totalQuantity winningPrice status isLate lateReason")
//       .populate("buyerBranchId",  "managerName companyName")
//       .sort({ createdAt: -1 })
//       .lean();

//     const invoiceIds = invoices.map(i => i._id);
//     const entries = await LedgerEntry.find({
//       entityType: "supplier", entityId: req.branch._id, invoiceId: { $in: invoiceIds },
//     }).lean();

//     // Net (credit - debit) + settled status per invoice
//     const perInvoice = {};
//     entries.forEach(e => {
//       const id = e.invoiceId.toString();
//       if (!perInvoice[id]) perInvoice[id] = { net: 0, allSettled: true };
//       perInvoice[id].net += e.direction === "credit" ? e.amount : -e.amount;
//       if (!e.settled) perInvoice[id].allSettled = false;
//     });

//     const bulkMap = {};

//     invoices.forEach((inv) => {
//       const bulkId = inv.bulkOrderId?._id?.toString() || "unknown";

//       if (!bulkMap[bulkId]) {
//         bulkMap[bulkId] = {
//           bulkOrderId:   inv.bulkOrderId?._id,
//           orderNumber:   `#ORD-${bulkId.slice(-6).toUpperCase()}`,
//           item:          inv.platformItemId?.name,
//           image:         inv.platformItemId?.image,
//           country:       inv.countryId?.name,
//           unit:          inv.platformItemId?.unit,
//           totalQuantity: inv.bulkOrderId?.totalQuantity,
//           winningPrice:  inv.bulkOrderId?.winningPrice,
//           isLate:        inv.bulkOrderId?.isLate || false,
//           lateReason:    inv.bulkOrderId?.lateReason || null,
//           createdAt:     inv.createdAt,
//           buyers:        [],
//           totalEarning:  0,
//           totalReleased: 0,
//           totalPending:  0,
//         };
//       }

//       const agg      = perInvoice[inv._id.toString()] || { net: 0, allSettled: false };
//       const amount   = Math.round(agg.net * 100) / 100;
//       const released = agg.allSettled && agg.net !== 0;

//       bulkMap[bulkId].buyers.push({
//         buyerName: inv.buyerBranchId?.managerName,
//         quantity:  inv.quantity,
//         amount,
//         released,
//       });

//       bulkMap[bulkId].totalEarning += amount;
//       if (released) bulkMap[bulkId].totalReleased += amount;
//       else          bulkMap[bulkId].totalPending  += amount;
//     });

//     const result = Object.values(bulkMap).map((b) => ({
//       ...b,
//       totalEarning:  Math.round(b.totalEarning  * 100) / 100,
//       totalReleased: Math.round(b.totalReleased * 100) / 100,
//       totalPending:  Math.round(b.totalPending  * 100) / 100,
//       buyersCount:   b.buyers.length,
//       paidCount:     b.buyers.filter((x) => x.released).length,
//     }));

//     const overall = {
//       totalEarning:  Math.round(result.reduce((s, r) => s + r.totalEarning,  0) * 100) / 100,
//       totalReleased: Math.round(result.reduce((s, r) => s + r.totalReleased, 0) * 100) / 100,
//       totalPending:  Math.round(result.reduce((s, r) => s + r.totalPending,  0) * 100) / 100,
//     };

//     res.json({ success: true, overall, total: result.length, data: result });
//   } catch (err) {
//     console.error("supplierPaymentSummary error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };