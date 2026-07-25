const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const bannerSchema = new mongoose.Schema(
  {
    tag:      { type: String, required: true, trim: true },   // e.g. "Sponsored", "This Week"
    title:    { type: String, required: true, trim: true },   // e.g. "Boost Your\nBusiness With Us"
    subtitle: { type: String, trim: true, default: "" },      // e.g. "Reach 10,000+ buyers"
    // ─── Image (pehle yahan emoji tha) ────────────────────
    //  Firebase Storage ka URL — folder: banner-images/
    image:    { type: String, default: null },
    bg:       { type: String, required: true, trim: true },   // hex color e.g. "#F15A21"
    waNumber: { type: String, required: true, trim: true },   // e.g. "97477876146"
    waText:   { type: String, required: true, trim: true },   // pre-filled whatsapp message
    order:    { type: Number, default: 0 },                   // display order
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["Banner"] ||
  El_Distributor.model("Banner", bannerSchema);