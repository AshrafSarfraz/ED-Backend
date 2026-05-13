const Invoice  = require("../models/invoice");
// const Branch   = require("../../src/models/Branch");

// ═══════════════════════════════════════════════════════
//  BUYER — Get My Invoices
//  GET /api/buyer/payments/invoices
// ═══════════════════════════════════════════════════════
exports.getMyInvoices = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can access this" });
    }

    const invoices = await Invoice.find({ buyerBranchId: req.branch._id })
      .populate("platformItemId", "name image unit")
      .populate("countryId", "name")
      .sort({ createdAt: -1 });

    // Fine calculate karo overdue invoices pe
    const now = new Date();
    for (const inv of invoices) {
      if (inv.paymentStatus === "unpaid" || inv.paymentStatus === "partial") {
        if (now > inv.dueDate) {
          const weeksOverdue = Math.floor((now - inv.dueDate) / (7 * 24 * 60 * 60 * 1000));
          if (weeksOverdue > 0) {
            const fineAmount = Math.round(inv.amountDue * 0.03 * weeksOverdue * 100) / 100;
            if (inv.fineAmount !== fineAmount) {
              await Invoice.findByIdAndUpdate(inv._id, {
                fineAmount,
                paymentStatus: "overdue",
                amountDue:     inv.grandTotal - inv.amountPaid + fineAmount,
              });
            }
          }
        }
      }
    }

    const updatedInvoices = await Invoice.find({ buyerBranchId: req.branch._id })
      .populate("platformItemId", "name image unit")
      .populate("countryId", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, total: updatedInvoices.length, data: updatedInvoices });
  } catch (err) {
    console.error("getMyInvoices error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  BUYER — Make Payment
//  POST /api/buyer/payments/pay/:invoiceId
// ═══════════════════════════════════════════════════════
exports.makePayment = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can make payments" });
    }

    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount required" });
    }

    const invoice = await Invoice.findOne({
      _id:          req.params.invoiceId,
      buyerBranchId: req.branch._id,
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    if (invoice.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "Invoice already paid" });
    }

    const newAmountPaid = invoice.amountPaid + Number(amount);
    const newAmountDue  = invoice.amountDue - Number(amount);

    let paymentStatus = "partial";
    if (newAmountDue <= 0) {
      paymentStatus = "paid";
    }

    await Invoice.findByIdAndUpdate(invoice._id, {
      amountPaid:    newAmountPaid,
      amountDue:     Math.max(0, newAmountDue),
      paymentStatus,
    });

    res.json({
      success: true,
      message: paymentStatus === "paid" ? "Invoice fully paid ✅" : "Payment recorded",
      data: {
        invoiceNumber: invoice.invoiceNumber,
        amountPaid:    newAmountPaid,
        amountDue:     Math.max(0, newAmountDue),
        paymentStatus,
      },
    });
  } catch (err) {
    console.error("makePayment error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Release Supplier Payment
//  PUT /api/admin/payments/release/:invoiceId
// ═══════════════════════════════════════════════════════
exports.releaseSupplierPayment = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    if (invoice.paymentStatus !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Buyer has not fully paid yet",
      });
    }

    if (invoice.supplierPaymentStatus === "released") {
      return res.status(400).json({ success: false, message: "Already released" });
    }

    await Invoice.findByIdAndUpdate(invoice._id, {
      supplierPaymentStatus: "released",
      supplierPaidAt:        new Date(),
    });

    res.json({ success: true, message: "Supplier payment released ✅" });
  } catch (err) {
    console.error("releaseSupplierPayment error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};