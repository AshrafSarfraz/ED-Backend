// 📁 models/RiderDebt.js
const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const riderDebtSchema = new mongoose.Schema(
  {
    deliveryCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryCompany", required: true },
    returnOrderId:     { type: mongoose.Schema.Types.ObjectId, ref: "ReturnOrder",     required: true },
    invoiceId:         { type: mongoose.Schema.Types.ObjectId, ref: "Invoice",         required: true },
    invoiceNumber:     { type: String, default: null },
    grandTotal:        { type: Number, default: 0 }, // 103%
    riderShare:        { type: Number, default: 0 }, // 1% monthly payment
    netOwed:           { type: Number, default: 0 }, // grandTotal - riderShare
    settled:           { type: Boolean, default: false },
    settledAt:         { type: Date,    default: null },
    note:              { type: String,  default: null },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["RiderDebt"] ||
  El_Distributor.model("RiderDebt", riderDebtSchema);
