// // 📁 models/ledger/Payout.js
// // Ek "payout event" — jab admin supplier/rider ko pay karta hai, ye record banta hai
// // aur us batch ki LedgerEntry documents isi Payout._id se link ho jaati hain (payoutId).
// const mongoose = require("mongoose");
// const { El_Distributor } = require("../../config/db");

// const payoutSchema = new mongoose.Schema(
//   {
//     entityType: { type: String, enum: ["supplier", "rider"], required: true },
//     entityId:   { type: mongoose.Schema.Types.ObjectId, required: true },

//     amount:      { type: Number, required: true }, // net amount actually paid out (credits - debits of settled entries)
//     entryCount:  { type: Number, default: 0 },

//     transactionRef: { type: String, default: null },
//     note:           { type: String, default: null },
//     paidBy:         { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
//     paidAt:         { type: Date, default: Date.now },
//   },
//   { timestamps: true }
// );

// module.exports =
//   El_Distributor.models["Payout"] ||
//   El_Distributor.model("Payout", payoutSchema);



// 📁 models/ledger/Payout.js
// Ek "payout event" — jab admin supplier/rider ko pay karta hai, ye record banta hai
// aur us batch ki LedgerEntry documents isi Payout._id se link ho jaati hain (payoutId).
const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const payoutSchema = new mongoose.Schema(
  {
    entityType: { type: String, enum: ["supplier", "rider"], required: true },
    entityId:   { type: mongoose.Schema.Types.ObjectId, required: true },

    amount:      { type: Number, required: true }, // net amount (credits - debits of settled entries)
    // "payout"   → hum ne entity ko diya (amount >= 0, normal case)
    // "recovery" → entity ne humein wapas diya (amount < 0, e.g. rider_guilty debt jo earning se zyada tha)
    // Optional field — purane records ke liye bhi kaam karega (amount ke sign se derive kar sakte hain)
    flowDirection: { type: String, enum: ["payout", "recovery"], default: null },
    entryCount:  { type: Number, default: 0 },

    transactionRef: { type: String, default: null },
    note:           { type: String, default: null },
    paidBy:         { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    paidAt:         { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["Payout"] ||
  El_Distributor.model("Payout", payoutSchema);