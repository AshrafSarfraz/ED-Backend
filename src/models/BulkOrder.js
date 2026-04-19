const mongoose = require("mongoose");
const { El_Distributor } = require("../config/db");

const bulkOrderSchema = new mongoose.Schema(
  {
    platformItemId:   { type: mongoose.Schema.Types.ObjectId, ref: "PlatformItem", required: true },
    countryId:        { type: mongoose.Schema.Types.ObjectId, ref: "Country",      required: true },
    totalQuantity:    { type: Number, required: true },
    buyerOrderIds:    [{ type: mongoose.Schema.Types.ObjectId, ref: "BuyerOrder" }],

    status: {
      type: String,
      enum: ["bidding", "awarded","ready", "cancelled"],
      default: "bidding",
    },

    winnerSupplierId: { type: mongoose.Schema.Types.ObjectId, ref: "branch", default: null },
    winningPrice:     { type: Number, default: null },
    bidDate:          { type: Date, required: true },
    biddingEndsAt:    { type: Date, required: true },
    retryCount:       { type: Number, default: 1 }, // ← naya field
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["BulkOrder"] ||
  El_Distributor.model("BulkOrder", bulkOrderSchema);