const mongoose = require("mongoose");
const { El_Distributor } = require("../config/db");

const partnerSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      required: [true, "Brand name is required"],
      trim: true,
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    businessType: {
      type: String,
      enum: ["Shop", "Restaurant", "Distributor"],
      required: [true, "Business type is required"],
    },
    accountType: {
      type: String,
      enum: ["Supplier", "Buyer"],
      required: [true, "Join as field is required"],
    },
    numberOfBranches: {
      type: Number,
      default: 1,
      min: [1, "Must have at least 1 branch"],
    },
    roleInBusiness: {
      type: String,
      enum: ["Owner / Partner", "Manager", "Legal Representative"],
      required: [true, "Role in business is required"],
    },
    tradeLicenseNumber: {
      type: String,
      required: [true, "Trade license number is required"],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["New Request", "Approved", "Rejected"],
      default: "New Request",
    },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

module.exports = El_Distributor.models['Partner'] || El_Distributor.model('Partner', partnerSchema);