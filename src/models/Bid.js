const mongoose = require("mongoose");
const { El_Distributor } = require("../config/db");

const bidSchema = new mongoose.Schema(
  {
    bulkOrderId:      { type: mongoose.Schema.Types.ObjectId, ref: "BulkOrder", required: true },
    supplierBranchId: { type: mongoose.Schema.Types.ObjectId, ref: "branch",    required: true },
    supplierCompanyId:{ type: mongoose.Schema.Types.ObjectId, ref: "Company",   required: true },
    pricePerUnit:     { type: Number, required: true },  // supplier ki bid price
    status: {
      type: String,
      enum: ["pending", "won", "lost"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["Bid"] ||
  El_Distributor.model("Bid", bidSchema);