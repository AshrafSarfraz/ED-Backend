const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const supplierItemSchema = new mongoose.Schema(
  {
    // ─── Links ────────────────────────────────────────────
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    platformItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlatformItem",
      required: true,
      // Tomato, Carrots etc — platform defined
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    countryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Country",
      required: true,
      // e.g. Pakistan, India
    },

    // ─── Supplier fills ───────────────────────────────────
    pricePerUnit: {
      type: Number,
      required: true,
      // QAR — supplier apni price set karega
    },

    // ─── Status ───────────────────────────────────────────
    isListed: {
      type: Boolean,
      default: true,
      // false = supplier ne hide kiya
    },

    isAvailableToday: {
      type: Boolean,
      default: true,
      // supplier daily toggle kar sakta hai
    },
  },
  { timestamps: true }
);

// ─── One supplier branch can list same item from different countries
// e.g. Pakistani Tomato + Indian Tomato — both allowed
supplierItemSchema.index({ branchId: 1, platformItemId: 1, countryId: 1 }, { unique: true });

// ─── ELIGIBILITY LOOKUP ──────────────────────────────────
//  Bidding ki saari queries is shape pe chalti hain:
//     { platformItemId, countryId, isListed, isAvailableToday }
//  Upar wala index branchId se shuru hota hai isliye wo USE HI NAHI HOTA —
//  ab tak har eligibility lookup full collection scan tha.
supplierItemSchema.index({ platformItemId: 1, countryId: 1, isListed: 1, isAvailableToday: 1 });

module.exports =
  El_Distributor.models["SupplierItem"] ||
  El_Distributor.model("SupplierItem", supplierItemSchema);