// 📁 models/SupplierDebt.js
const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const supplierDebtSchema = new mongoose.Schema(
  {
    supplierBranchId: { type: mongoose.Schema.Types.ObjectId, ref: "branch",      required: true },
    returnOrderId:    { type: mongoose.Schema.Types.ObjectId, ref: "ReturnOrder", required: true },
    bulkOrderId:      { type: mongoose.Schema.Types.ObjectId, ref: "BulkOrder",   required: true },
    amount:           { type: Number, required: true },
    settled:          { type: Boolean, default: false },
    settledFromBulk:  { type: mongoose.Schema.Types.ObjectId, ref: "BulkOrder", default: null },
    settledAt:        { type: Date,    default: null },
    note:             { type: String,  default: null },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["SupplierDebt"] ||
  El_Distributor.model("SupplierDebt", supplierDebtSchema);
