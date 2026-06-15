// 📁 models/Bid.js
const mongoose = require("mongoose");
const { El_Distributor } = require("../config/db");

const bidSchema = new mongoose.Schema(
  {
    bulkOrderId:      { type: mongoose.Schema.Types.ObjectId, ref: "BulkOrder", required: true },
    supplierBranchId: { type: mongoose.Schema.Types.ObjectId, ref: "branch",    required: true },
    supplierCompanyId:{ type: mongoose.Schema.Types.ObjectId, ref: "Company",   required: true },

    // bid price — sirf jab supplier ne actually bid lagayi ho
    // ignored / missed pe null rehta hai
    pricePerUnit:     { type: Number, default: null },

    status: {
      type: String,
      enum: ["pending", "won", "lost", "ignored", "missed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// ek supplier ka ek hi record per bulk order
bidSchema.index({ bulkOrderId: 1, supplierBranchId: 1 }, { unique: true });

module.exports =
  El_Distributor.models["Bid"] ||
  El_Distributor.model("Bid", bidSchema);