// 📁 models/BillInvoice.js
// ═══════════════════════════════════════════════════════
//  BILL INVOICE — har din, har branch ka EK bill.
//
//  Item invoice (INV-B-… / INV-S-…) = per buyer-order, wo pehle se system me hai.
//  Bill invoice (BILL-B-… / BILL-S-…) = us din ke saare item invoices ka ek header.
//
//  Buyer   → BILL-B-20260806-0001  (buyer se paisa LENA hai)
//  Supplier→ BILL-S-20260806-0001  (supplier ko paisa DENA hai / payment advice)
//
//  Bidding winner cron ke baad ban'ta hai. Aage buyer outstanding statement aur
//  supplier payment advice — dono isi number pe print hote hain.
// ═══════════════════════════════════════════════════════
const mongoose = require("mongoose");
const { El_Distributor } = require("../config/db");

const billInvoiceSchema = new mongoose.Schema(
  {
    // BILL-B-20260806-0001  |  BILL-S-20260806-0001
    billNumber: { type: String, required: true, unique: true, trim: true },
    billType:   { type: String, enum: ["buyer", "supplier"], required: true },

    // "2026-08-06" — grouping key (UTC day, cron ke dateStr se match karta hai)
    billDate:   { type: String, required: true },
    billDateAt: { type: Date,   required: true },

    branchId:  { type: mongoose.Schema.Types.ObjectId, ref: "branch",  required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },

    // Snapshot — branch delete/rename ho jaye to bhi bill readable rahe
    branchName:  { type: String, default: null },
    companyName: { type: String, default: null },

    invoiceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Invoice" }],
    itemCount:  { type: Number, default: 0 },

    subTotal:        { type: Number, default: 0 }, // items ka raw total
    commissionTotal: { type: Number, default: 0 }, // sirf buyer bill pe
    deliveryTotal:   { type: Number, default: 0 }, // sirf buyer bill pe
    deductionTotal:  { type: Number, default: 0 }, // sirf supplier bill pe (return penalty etc.)
    grandTotal:      { type: Number, default: 0 },

    amountPaid: { type: Number, default: 0 },
    amountDue:  { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["unpaid", "partial", "paid", "cancelled"],
      default: "unpaid",
    },

    dueDate:   { type: Date, default: null },
    settledAt: { type: Date, default: null },
    note:      { type: String, default: null },
  },
  { timestamps: true }
);

// Ek branch ka ek din me ek hi bill (per type) — regenerate safe rahe
billInvoiceSchema.index({ billType: 1, billDate: 1, branchId: 1 }, { unique: true });
billInvoiceSchema.index({ billType: 1, billDate: -1 });
billInvoiceSchema.index({ branchId: 1, status: 1 });

module.exports =
  El_Distributor.models["BillInvoice"] ||
  El_Distributor.model("BillInvoice", billInvoiceSchema);
