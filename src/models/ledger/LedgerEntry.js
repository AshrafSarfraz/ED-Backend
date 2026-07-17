// 📁 models/ledger/LedgerEntry.js
// ═══════════════════════════════════════════════════════
//  IMMUTABLE ledger — har financial transaction (earning, penalty, debt, fee)
//  ek entry ke roop mein yahan likhi jaati hai. Purani entry KABHI edit nahi hoti —
//  sirf naye entries add hoti hain. Balance hamesha entries se LIVE calculate hota hai
//  (kabhi kisi single field mein "cache" nahi hota) — isse ye bugs khatam ho jaate hain
//  jahan alag-alag jagah alag-alag manual +/- math likhne se numbers mismatch ho jaate the.
// ═══════════════════════════════════════════════════════
const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const ledgerEntrySchema = new mongoose.Schema(
  {
    entityType: { type: String, enum: ["supplier", "rider", "platform"], required: true },
    entityId:   { type: mongoose.Schema.Types.ObjectId, required: true }, // Branch or DeliveryCompany _id

    direction: { type: String, enum: ["credit", "debit"], required: true }, // credit = entity ko milna hai, debit = kata gaya
    amount:    { type: Number, required: true, min: 0 }, // hamesha positive — direction se pata chalta hai kis taraf

    category: {
      type: String,
      required: true,
      enum: [
        "order_earning",      // supplier credit — poora order amount, invoice banne pe
        "return_penalty",     // supplier debit  — 2%, return supplier_guilty resolve hone pe
        "delivery_fee",       // rider credit    — 1%, normal forward delivery complete hone pe
        "return_leg_fee",     // rider credit    — 1%, return pickup leg (supplier_guilty) ke liye
        "rider_guilty_debt",  // rider debit     — poora order amount, rider_guilty resolve hone pe
        "commission",         // platform credit — 2%, invoice banne pe
      ],
    },

    // References — kis order/invoice ki wajah se ye entry bani (traceability)
    invoiceId:    { type: mongoose.Schema.Types.ObjectId, ref: "Invoice",     default: null },
    bulkOrderId:  { type: mongoose.Schema.Types.ObjectId, ref: "BulkOrder",   default: null },
    buyerOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "BuyerOrder",  default: null },
    returnOrderId:{ type: mongoose.Schema.Types.ObjectId, ref: "ReturnOrder", default: null },

    // Settlement (payout) tracking
    settled:   { type: Boolean, default: false },
    settledAt: { type: Date,    default: null },
    payoutId:  { type: mongoose.Schema.Types.ObjectId, ref: "Payout", default: null },

    note: { type: String, default: null },
  },
  { timestamps: true }
);

// Ek invoice pe ek hi category ki entry dobara na bane (idempotency guard)
ledgerEntrySchema.index({ invoiceId: 1, category: 1, entityType: 1 }, { unique: true, partialFilterExpression: { invoiceId: { $type: "objectId" } } });
ledgerEntrySchema.index({ entityType: 1, entityId: 1, settled: 1 });
ledgerEntrySchema.index({ entityType: 1, entityId: 1, createdAt: 1 });

module.exports =
  El_Distributor.models["LedgerEntry"] ||
  El_Distributor.model("LedgerEntry", ledgerEntrySchema);
