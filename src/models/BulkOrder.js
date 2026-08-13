const mongoose = require("mongoose");
const { El_Distributor } = require("../config/db");

const bulkOrderSchema = new mongoose.Schema(
  {
    platformItemId:   { type: mongoose.Schema.Types.ObjectId, ref: "PlatformItem", required: true },
    countryId:        { type: mongoose.Schema.Types.ObjectId, ref: "Country",      required: true },
    totalQuantity:    { type: Number, required: true },
    buyerOrderIds:    [{ type: mongoose.Schema.Types.ObjectId, ref: "BuyerOrder" }],
    minPrice:         { type: Number, default: null },
    maxPrice:         { type: Number, default: null },

    status: {
      type: String,
      enum: ["bidding", "awarded", "ready", "cancelled"],
      default: "bidding",
    },

    winnerSupplierId: { type: mongoose.Schema.Types.ObjectId, ref: "branch",  default: null },
    winningPrice:     { type: Number, default: null },

    // ─── PROXY BIDDING — live state ────────────────────────
    //  currentBid sirf biddingEngine.recompute() likhta hai, aur koi nahi.
    currentBid:      { type: Number, default: null },
    currentLeaderId: { type: mongoose.Schema.Types.ObjectId, ref: "branch", default: null },

    //  recompute() read-modify-write hai — do supplier ek saath bid karein
    //  to currentBid CHUP-CHAAP galat likh jayegi. Isliye lock.
    recomputing:   { type: Boolean, default: false },
    recomputingAt: { type: Date,    default: null },

    //  Closing reminder ek hi baar jaye (cron retry / restart safe)
    reminderSentAt: { type: Date, default: null },
    bidDate:          { type: Date,   required: true },
    biddingEndsAt:    { type: Date,   required: true },
    retryCount:       { type: Number, default: 1 },
    estimatedDays:    { type: Number, default: null },
    readyAt:          { type: Date,   default: null },

    isLate:     { type: Boolean, default: false },
    lateReason: { type: String,  default: null },
  },
  { timestamps: true }
);

// winner cron + reminder cron dono is shape pe query karte hain
bulkOrderSchema.index({ status: 1, biddingEndsAt: 1 });
// runBiddingStart ka existing-bulk lookup
bulkOrderSchema.index({ status: 1, platformItemId: 1, countryId: 1 });

module.exports =
  El_Distributor.models["BulkOrder"] ||
  El_Distributor.model("BulkOrder", bulkOrderSchema);