const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

// Single-document model — always one active T&C
// Admin updates the content; app fetches the latest version
const termsSchema = new mongoose.Schema(
  {
    content:   { type: String, required: true },  // full HTML or markdown text
    version:   { type: String, required: true, trim: true },  // e.g. "1.0", "1.1"
    isActive:  { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["TermsAndConditions"] ||
  El_Distributor.model("TermsAndConditions", termsSchema);
