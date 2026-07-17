// 📁 models/riderCompany/riderEarning.js
// Rider ki har earning entry — normal delivery (1%) ya return-leg (extra 1%)
// Rider debt (RiderDebt) se ALAG record hai — settlement ke waqt dono net kiye jaate hain
const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const riderEarningSchema = new mongoose.Schema(
  {
    deliveryCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryCompany", required: true },
    invoiceId:         { type: mongoose.Schema.Types.ObjectId, ref: "Invoice",         required: true },
    invoiceNumber:     { type: String, default: null },
    bulkOrderId:       { type: mongoose.Schema.Types.ObjectId, ref: "BulkOrder",  default: null },
    buyerOrderId:      { type: mongoose.Schema.Types.ObjectId, ref: "BuyerOrder", default: null },

    grandTotal: { type: Number, default: 0 }, // reference — order ka poora amount jis pe % nikla

    // "delivery"    → normal forward delivery leg (supplier → buyer), 1%
    // "return_leg"  → return pickup leg (buyer → supplier) jab supplier guilty ho, extra 1%
    reason: { type: String, enum: ["delivery", "return_leg"], required: true },

    earningPct:    { type: Number, required: true }, // e.g. 1
    earningAmount: { type: Number, required: true }, // actual QAR amount

    // Monthly settlement tracking (jaisa supplier payments mein hota hai)
    settled:   { type: Boolean, default: false },
    settledAt: { type: Date,    default: null },
  },
  { timestamps: true }
);

// Ek invoice pe ek hi reason ki entry dobara na bane
riderEarningSchema.index({ invoiceId: 1, reason: 1 }, { unique: true });

module.exports =
  El_Distributor.models["RiderEarning"] ||
  El_Distributor.model("RiderEarning", riderEarningSchema);
