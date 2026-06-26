// 📁 models/ReturnOrder.js
const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const returnOrderSchema = new mongoose.Schema(
  {
    buyerOrderId:     { type: mongoose.Schema.Types.ObjectId, ref: "BuyerOrder",     required: true },
    bulkOrderId:      { type: mongoose.Schema.Types.ObjectId, ref: "BulkOrder",      required: true },
    buyerBranchId:    { type: mongoose.Schema.Types.ObjectId, ref: "branch",         required: true },
    supplierBranchId: { type: mongoose.Schema.Types.ObjectId, ref: "branch",         required: true },
    invoiceId:        { type: mongoose.Schema.Types.ObjectId, ref: "Invoice",        required: true },
    deliveryOrderId:  { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryOrder",  default: null },
    deliveryCompanyId:{ type: mongoose.Schema.Types.ObjectId, ref: "DeliveryCompany",default: null },

    // ─── Buyer Request ────────────────────────────────────
    subject:     { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    images:      [{ type: String }], // max 3 Firebase URLs

    // ─── Amounts ─────────────────────────────────────────
    orderGrandTotal:  { type: Number, default: 0 }, // 103%
    orderRawAmount:   { type: Number, default: 0 }, // 100%
    deliveryCharge:   { type: Number, default: 0 }, // 1%
    commissionAmount: { type: Number, default: 0 }, // 2%
    penaltyAmount:    { type: Number, default: 0 }, // 2% of rawAmount

    // ─── Status ───────────────────────────────────────────
    status: {
      type: String,
      enum: [
        "pending",
        "supplier_accepted",
        "supplier_rejected",
        "resolved_cancelled",
        "resolved_supplier_guilty",
        "resolved_rider_guilty",
      ],
      default: "pending",
    },

    // ─── Supplier ────────────────────────────────────────
    supplierNote:        { type: String, default: null },
    supplierRespondedAt: { type: Date,   default: null },

    // ─── Admin ───────────────────────────────────────────
    adminNote:       { type: String, default: null },
    adminResolvedAt: { type: Date,   default: null },
    resolvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },

    // ─── Penalty (supplier guilty) ───────────────────────
    penaltyApplied:    { type: Boolean, default: false },
    penaltyCutFrom:    [{
      bulkOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "BulkOrder" },
      amountCut:   { type: Number, default: 0 },
    }],
    supplierDebtAdded: { type: Number, default: 0 },

    // ─── Rider debt (rider guilty) ────────────────────────
    riderDebtRecorded: { type: Boolean, default: false },
    riderDebtAmount:   { type: Number,  default: 0 },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["ReturnOrder"] ||
  El_Distributor.model("ReturnOrder", returnOrderSchema);
