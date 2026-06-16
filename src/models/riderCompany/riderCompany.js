// 📁 models/rider/deliveryCompany.js
// Delivery company ka login account (email + password)
const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");
const bcrypt = require("bcryptjs");

const deliveryCompanySchema = new mongoose.Schema(
  {
    name:      { type: String, required: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:  { type: String, required: true },
    phone:     { type: String, default: null },
    isActive:  { type: Boolean, default: true },
  },
  { timestamps: true }
);

// password hash before save
deliveryCompanySchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

deliveryCompanySchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports =
  El_Distributor.models["DeliveryCompany"] ||
  El_Distributor.model("DeliveryCompany", deliveryCompanySchema);