const mongoose = require("mongoose");
const { El_Distributor } = require("../config/db");

const invoiceSchema = new mongoose.Schema(
  {
    buyerOrderId:     { type: mongoose.Schema.Types.ObjectId, ref: "BuyerOrder",   required: true },
    bulkOrderId:      { type: mongoose.Schema.Types.ObjectId, ref: "BulkOrder",    required: true },
    buyerBranchId:    { type: mongoose.Schema.Types.ObjectId, ref: "branch",       required: true },
    buyerCompanyId:   { type: mongoose.Schema.Types.ObjectId, ref: "Company",      required: true },
    supplierBranchId: { type: mongoose.Schema.Types.ObjectId, ref: "branch",       required: true },
    platformItemId:   { type: mongoose.Schema.Types.ObjectId, ref: "PlatformItem", required: true },
    countryId:        { type: mongoose.Schema.Types.ObjectId, ref: "Country",      required: true },

    invoiceNumber:  { type: String, unique: true },
    invoiceStatus:  { type: String, enum: ["draft", "final"], default: "draft" },

    // ─── Amounts ──────────────────────────────────────────
    quantity:         { type: Number, required: true },
    unit:             { type: String,  required: true },
    pricePerUnit:     { type: Number, required: true },
    totalAmount:      { type: Number, required: true }, // quantity × pricePerUnit

    // ─── Commission (3% = 2% platform + 1% delivery) ─────
    commissionRate:   { type: Number, default: 2 },     // 2% platform
    commissionAmount: { type: Number, default: 0 },
    deliveryRate:     { type: Number, default: 1 },     // 1% delivery
    deliveryAmount:   { type: Number, default: 0 },
    totalFeeAmount:   { type: Number, default: 0 },     // 3% total

    // ─── Delivery Charge (distance based) ─────────────────
    deliveryCharge:   { type: Number, default: 0 },

    // ─── Grand Total ──────────────────────────────────────
    grandTotal:       { type: Number, default: 0 },     // totalAmount + totalFeeAmount + deliveryCharge

    // ─── Payment ──────────────────────────────────────────
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid", "overdue"],
      default: "unpaid",
    },
    amountPaid:  { type: Number, default: 0 },
    amountDue:   { type: Number, required: true },
    dueDate:     { type: Date,   required: true },      // 30 days
    fineAmount:  { type: Number, default: 0 },          // 3% per week overdue

    // ─── Redelivery ───────────────────────────────────────
    redeliveryCount:  { type: Number, default: 0 },
    redeliveryCharge: { type: Number, default: 0 },

    // ─── Delivery ─────────────────────────────────────────
    deliveryStatus: {
      type: String,
      enum: ["pending", "dispatched", "delivered", "returned", "cancelled"],
      default: "pending",
    },
    deliveredAt:    { type: Date, default: null },
    returnDeadline: { type: Date, default: null },      // deliveredAt + 24hrs

    // ─── Return ───────────────────────────────────────────
    returnReason: {
      type: String,
      enum: ["incorrect", "damaged", "rotten", "expired", null],
      default: null,
    },
    returnFault: {
      type: String,
      enum: ["supplier", "rider", null],
      default: null,
    },
    returnPenalty: { type: Number, default: 0 },        // 2% if supplier fault

    // ─── Supplier Payment ─────────────────────────────────
    supplierPaymentStatus: {
      type: String,
      enum: ["pending", "released"],
      default: "pending",
    },
    supplierPaidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["Invoice"] ||
  El_Distributor.model("Invoice", invoiceSchema);