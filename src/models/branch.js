const mongoose = require("mongoose");
const { El_Distributor } = require("../config/db");

const branchSchema = new mongoose.Schema(
  {
    companyId:   { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    companyName: { type: String, required: true, trim: true },
    accountType: { type: String, enum: ["Supplier", "Buyer"], required: true },
    managerName: { type: String, required: true, trim: true },
    phone:       { type: String, required: true, trim: true },
    email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:    { type: String, required: true },

    address: {
      lat:     { type: Number, default: null },
      lng:     { type: Number, default: null },
      address: { type: String, default: null },
      area:    { type: String, default: null },
      city:    { type: String, default: null },
    },

    warehouseAddress: {
      lat:     { type: Number, default: null },
      lng:     { type: Number, default: null },
      address: { type: String, default: null },
      area:    { type: String, default: null },
      city:    { type: String, default: null },
    },

    bankDetails: {
      accountName:   { type: String, default: null },
      accountNumber: { type: String, default: null },
      iban:          { type: String, default: null },
      bankName:      { type: String, default: null },
    },

    contractPdf: { type: String, default: null },
    pdcImage:    { type: String, default: null },
    pdcAmount:   { type: Number, default: null },

    defaultPackingDays: { type: Number, default: 2 },

    cancellationCount: { type: Number, default: 0 },
    isBanned:          { type: Boolean, default: false },
    bannedUntil:       { type: Date,    default: null },

    registrationStep:  { type: Number, default: 1 },
    status:            { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    rejectionReason:   { type: String, default: null },
    isActive:          { type: Boolean, default: true },
    isPasswordChanged: { type: Boolean, default: false },
    branchLogo:        { type: String, default: null },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["branch"] ||
  El_Distributor.model("branch", branchSchema);