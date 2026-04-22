const mongoose = require("mongoose");
const { El_Distributor } = require("../config/db");

const branchSchema = new mongoose.Schema(
  {
    // ─── Step 0.1 Fields ──────────────────────────────────
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    accountType: {
      type: String,
      enum: ["Supplier", "Buyer"],
      required: true,
    },

    managerName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      // email won't be changed after creation — enforced in controller
    },

    password: {
      type: String,
      required: true,
    },

    // ─── Step 0.2 Fields ──────────────────────────────────
    address: {
      lat:     { type: Number, default: null },
      lng:     { type: Number, default: null },
      address: { type: String, default: null },
      area:    { type: String, default: null },
      city:    { type: String, default: null },
    },

    bankDetails: {
      accountName: { type: String, default: null },
      accountNumber: { type: String, default: null },
      iban: { type: String, default: null },
      bankName: { type: String, default: null },
    },

    registrationStep: {
      type: Number,
      default: 1,
      // 1 = basic info done
      // 2 = address + bank done
      // 3 = catalog added (only for supplier)
    },

    // ─── Status & Admin Control ───────────────────────────
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    rejectionReason: {
      type: String,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isPasswordChanged: {
      type: Boolean,
      default: false,
    },
    warehouseAddress: {
      lat:     { type: Number, default: null },
      lng:     { type: Number, default: null },
      address: { type: String, default: null },
      area:    { type: String, default: null },
      city:    { type: String, default: null },
    },

    // ─── Step 0.3 — Catalog (Supplier Only) ───────────────
    // Items are stored in a separate Item/Catalog model
    // linked via branchId — not stored here
    // registrationStep = 3 means catalog has been added

    // ─── Profile Image (Optional) ─────────────────────────
    branchLogo: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["branch"] ||
  El_Distributor.model("branch", branchSchema);
