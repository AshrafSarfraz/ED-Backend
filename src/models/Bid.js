// 📁 models/Bid.js
// ═══════════════════════════════════════════════════════
//  PROXY BIDDING
//
//  Supplier ab "price" nahi bhejta — apni MAX BID bhejta hai,
//  yaani "is se neeche main nahi jaunga". Ye number PRIVATE hai
//  aur kabhi kisi doosre supplier ko nahi dikhta.
//
//  openBid  = join ke waqt uski catalog price ka snapshot.
//             Baad me catalog badle to live bidding pe asar nahi hota.
//  maxBid   = private floor. Max na di ho to = openBid.
//  joinedAt = join ka waqt. TIE-BREAK yahi hai.
//             ⚠️ maxBid lower karne pe ye NAHI badalta, warna
//             supplier apni queue position kho dega.
// ═══════════════════════════════════════════════════════
const mongoose = require("mongoose");
const { El_Distributor } = require("../config/db");

const bidSchema = new mongoose.Schema(
  {
    bulkOrderId:      { type: mongoose.Schema.Types.ObjectId, ref: "BulkOrder", required: true },
    supplierBranchId: { type: mongoose.Schema.Types.ObjectId, ref: "branch",    required: true },
    supplierCompanyId:{ type: mongoose.Schema.Types.ObjectId, ref: "Company",   required: true },

    // join ke waqt catalog price — snapshot, ceiling ka kaam karti hai
    openBid:  { type: Number, required: true },

    // supplier ka private floor — max na di ho to openBid ke barabar
    maxBid:   { type: Number, required: true },

    // TIE-BREAK — freeze at join, max update pe NA badlein
    joinedAt: { type: Date, required: true, default: Date.now },

    status: {
      type: String,
      // active = bidding chal rahi hai / withdraw ka option nahi hai
      // missed = eligible tha lekin join hi nahi kiya
      enum: ["active", "won", "lost", "missed"],
      default: "active",
    },
  },
  { timestamps: true }
);

// ek supplier ka ek hi record per bulk order
bidSchema.index({ bulkOrderId: 1, supplierBranchId: 1 }, { unique: true });

// recompute() ka sort — (maxBid asc, joinedAt asc). Har bid pe chalta hai.
bidSchema.index({ bulkOrderId: 1, status: 1, maxBid: 1, joinedAt: 1 });

// getMyBids — compound unique ka prefix bulkOrderId hai, ye cover nahi hota
bidSchema.index({ supplierBranchId: 1, createdAt: -1 });

module.exports =
  El_Distributor.models["Bid"] ||
  El_Distributor.model("Bid", bidSchema);
