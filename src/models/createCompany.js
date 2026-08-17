const mongoose = require("mongoose");
const { El_Distributor } = require("../config/db");

const companySchema = new mongoose.Schema(
  {
    partnerId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Partner",
      required: true,
      unique:   true,
    },
    brandName:        { type: String, required: true, trim: true },
    firstName:        { type: String, required: true, trim: true },
    lastName:         { type: String, required: true, trim: true },
    email:            { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:            { type: String, required: true, trim: true },
    businessType:     { type: String, enum: ["Shop", "Restaurant", "Distributor"], required: true },
    accountType:      { type: String, enum: ["Supplier", "Buyer"], required: true },
    numberOfBranches: { type: Number, default: 1 },
    roleInBusiness:   { type: String, enum: ["Owner / Partner", "Manager", "Legal Representative"], required: true },
    tradeLicenseNumber: { type: String, required: true, unique: true, trim: true },
    password:           { type: String, required: true },
    isPasswordChanged:  { type: Boolean, default: false },
    isActive:           { type: Boolean, default: true },

    // ─── Company Logo ──────────────────────────────────
    companyLogo: { type: String, default: null },

    // ─── Trade License ─────────────────────────────────
    tradeLicenseImage:  { type: String, default: null },
    tradeLicenseExpiry: { type: Date,   default: null },
    tradeLicenseStatus: {
      type:    String,
      enum:    ["pending", "submitted", "approved", "rejected", "expired"],
      default: "pending",
    },

    // ─── QID ───────────────────────────────────────────
    qidImage:  { type: String, default: null },
    qidExpiry: { type: Date,   default: null },
    qidStatus: {
      type:    String,
      enum:    ["pending", "submitted", "approved", "rejected", "expired"],
      default: "pending",
    },

    crNumber: { type: String, default: null, trim: true },
    crImage:  { type: String, default: null },
    crExpiry: { type: Date,   default: null },
    crStatus: {
      type:    String,
      enum:    ["pending", "submitted", "approved", "rejected", "expired"],
      default: "pending",
    },

    // ─── Overall Documents Status ──────────────────────
    documentsStatus: {
      type:    String,
      enum:    ["pending", "submitted", "approved", "rejected"],
      default: "pending",
    },
    documentsRejectionReason: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["Company"] ||
  El_Distributor.model("Company", companySchema);