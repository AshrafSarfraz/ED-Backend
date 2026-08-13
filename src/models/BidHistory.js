// 📁 models/BidHistory.js
// ═══════════════════════════════════════════════════════
//  APPEND-ONLY audit log. Kabhi update ya delete nahi hota.
//
//  Kyun zaroori hai: proxy bidding me supplier tie pe sirf join order
//  ki wajah se haar sakta hai (dono ki maxBid barabar). Jab wo poochega
//  "meri bhi to 4.80 thi, main kaise haara?" — bina is log ke aap
//  jawab nahi de sakte. Ye rozana hoga.
// ═══════════════════════════════════════════════════════
const mongoose = require("mongoose");
const { El_Distributor } = require("../config/db");

const bidHistorySchema = new mongoose.Schema(
  {
    bulkOrderId:       { type: mongoose.Schema.Types.ObjectId, ref: "BulkOrder", required: true },
    supplierBranchId:  { type: mongoose.Schema.Types.ObjectId, ref: "branch",    required: true },
    supplierCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company",   default: null },

    action:  { type: String, enum: ["join", "lower_max"], required: true },

    openBid: { type: Number, required: true },
    maxBid:  { type: Number, required: true },
    previousMaxBid: { type: Number, default: null },   // lower_max pe

    // is action ke NATEEJE me kya bana
    resultingCurrentBid: { type: Number, default: null },
    resultingLeaderId:   { type: mongoose.Schema.Types.ObjectId, ref: "branch", default: null },
    leaderChanged:       { type: Boolean, default: false },

    at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

bidHistorySchema.index({ bulkOrderId: 1, at: 1 });
bidHistorySchema.index({ supplierBranchId: 1, at: -1 });

module.exports =
  El_Distributor.models["BidHistory"] ||
  El_Distributor.model("BidHistory", bidHistorySchema);
