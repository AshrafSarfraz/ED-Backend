// 📁 models/PaymentReceipt.js
const mongoose = require("mongoose");
const { El_Distributor } = require("../config/db");

const paymentReceiptSchema = new mongoose.Schema(
  {
    // ─── Buyer Info ───────────────────────────────────────
    buyerBranchId:  { type: mongoose.Schema.Types.ObjectId, ref: "branch",  required: true },
    buyerCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    // ─── Invoices jo is payment mein cover ho rahe hain ───
    // Buyer ek baar mein multiple invoices ki payment kar sakta hai
    invoiceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Invoice" }],

    // ─── Payment Details ──────────────────────────────────
    totalAmount:   { type: Number, required: true }, // buyer ne kitna claim kiya
    receiptImage:  { type: String, default: null },  // Firebase URL
    note:          { type: String, default: null },  // buyer ka note

    // ─── Status ───────────────────────────────────────────
    status: {
      type:    String,
      enum:    ["pending", "approved", "rejected"],
      default: "pending",
    },

    // ─── Admin ────────────────────────────────────────────
    approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    approvedAt:  { type: Date,   default: null },
    adminNote:   { type: String, default: null },

    // ─── Supplier release tracking ────────────────────────
    // Approve hone ke baad kitne suppliers ko release hua
    suppliersReleased: { type: Number, default: 0 },
    totalReleased:     { type: Number, default: 0 }, // total amount released to suppliers
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["PaymentReceipt"] ||
  El_Distributor.model("PaymentReceipt", paymentReceiptSchema);