const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const buyerOrderSchema = new mongoose.Schema(
  {
    buyerBranchId:  { type: mongoose.Schema.Types.ObjectId, ref: "branch",       required: true },
    buyerCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company",      required: true },
    platformItemId: { type: mongoose.Schema.Types.ObjectId, ref: "PlatformItem", required: true },
    countryId:      { type: mongoose.Schema.Types.ObjectId, ref: "Country",      required: true },
    quantity:       { type: Number, required: true, min: 1 },

    status: {
      type: String,
      enum: ["pending", "in_bidding", "won", "delivered", "cancelled"],
      default: "pending",
    },

    bulkOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "BulkOrder", default: null },
    bidDate:     { type: Date, default: null }, // kis din ki bidding mein jayega
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["BuyerOrder"] ||
  El_Distributor.model("BuyerOrder", buyerOrderSchema);