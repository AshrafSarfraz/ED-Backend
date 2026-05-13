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

    invoiceNumber: { type: String, unique: true },
    invoiceType:   { type: String, enum: ["buyer", "supplier"], default: "buyer" },
    invoiceStatus: { type: String, enum: ["final"], default: "final" },

    quantity:     { type: Number, required: true },
    unit:         { type: String, required: true },
    pricePerUnit: { type: Number, required: true },

    totalAmount:      { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },
    deliveryAmount:   { type: Number, default: 0 },
    totalFeeAmount:   { type: Number, default: 0 },
    deliveryCharge:   { type: Number, default: 0 },
    grandTotal:       { type: Number, default: 0 },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid", "overdue"],
      default: "unpaid",
    },
    amountPaid:  { type: Number, default: 0 },
    amountDue:   { type: Number, required: true },
    dueDate:     { type: Date,   required: true },
    fineAmount:  { type: Number, default: 0 },

    deliveryStatus: {
      type: String,
      enum: ["pending", "picked_up", "delivered", "returned", "cancelled"],
      default: "pending",
    },
    deliveredAt:    { type: Date,   default: null },
    returnDeadline: { type: Date,   default: null },
    returnReason:   { type: String, default: null },

    supplierPaymentStatus: {
      type: String,
      enum: ["pending", "released", "deducted"],
      default: "pending",
    },
    supplierPaidAt:    { type: Date,   default: null },
    supplierDeduction: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["Invoice"] ||
  El_Distributor.model("Invoice", invoiceSchema);