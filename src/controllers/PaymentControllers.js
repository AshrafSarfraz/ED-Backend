// 📁 controllers/PaymentController.js
const Invoice        = require("../models/invoice");
const PaymentReceipt = require("../models/Payment");
const Branch         = require("../models/Branch");
const { uploadToFirebase } = require("../config/uploadToFirebase");

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

    let totalDue = 0, totalPaid = 0, totalOverdue = 0;
    const now = new Date();

    invoices.forEach((inv) => {
      if (inv.paymentStatus === "paid") {
        totalPaid += inv.grandTotal;
      } else {
        totalDue += inv.amountDue;
        if (now > new Date(inv.dueDate)) totalOverdue += inv.amountDue;
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
          totalDue:      Math.round(totalDue     * 100) / 100,
          totalPaid:     Math.round(totalPaid    * 100) / 100,
          totalOverdue:  Math.round(totalOverdue * 100) / 100,
          totalInvoices: invoices.length,
          unpaidCount:   invoices.filter((i) => !["paid", "cancelled"].includes(i.paymentStatus)).length,
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

exports.submitReceipt = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can access this" });
    }

    const { invoiceIds, totalAmount, note } = req.body;
    if (!invoiceIds || !totalAmount) {
      return res.status(400).json({ success: false, message: "invoiceIds and totalAmount are required" });
    }

    const ids = Array.isArray(invoiceIds) ? invoiceIds : JSON.parse(invoiceIds);

    const invoices = await Invoice.find({
      _id:           { $in: ids },
      buyerBranchId: req.branch._id,
      invoiceType:   "buyer",
      paymentStatus: { $ne: "paid" },
    });

    if (invoices.length === 0) {
      return res.status(400).json({ success: false, message: "No valid unpaid invoices found" });
    }

    let receiptImageUrl = null;
    if (req.file) {
      receiptImageUrl = await uploadToFirebase(
        req.file.buffer, req.file.originalname,
        `payment-receipts/${req.branch._id}`
      );
    }

    const receipt = await PaymentReceipt.create({
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
      data: { receiptId: receipt._id, totalAmount: receipt.totalAmount, invoiceCount: ids.length, status: receipt.status },
    });
  } catch (err) {
    console.error("submitReceipt error:", err);
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
//  Buyer invoice → paid
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
      // Buyer invoice → paid
      await Invoice.findByIdAndUpdate(inv._id, {
        paymentStatus: "paid",
        amountPaid:    inv.grandTotal,
        amountDue:     0,
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

exports.rejectReceipt = async (req, res) => {
  try {
    const { adminNote } = req.body;
    if (!adminNote) return res.status(400).json({ success: false, message: "Rejection reason required" });

    const receipt = await PaymentReceipt.findById(req.params.receiptId);
    if (!receipt) return res.status(404).json({ success: false, message: "Receipt not found" });
    if (receipt.status !== "pending") return res.status(400).json({ success: false, message: "Receipt already processed" });

    await PaymentReceipt.findByIdAndUpdate(receipt._id, {
      status:     "rejected",
      approvedBy: req.admin._id,
      approvedAt: new Date(),
      adminNote,
    });

    res.json({ success: true, message: "Receipt rejected." });
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