// 📁 models/riderCompany/riderCompany.js
// Delivery company ka login account (email + password)
const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");
const bcrypt = require("bcryptjs");

const deliveryCompanySchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone:    { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ─── Password hash before save ───
// NOTE: regular function (arrow nahi) — taaki `this` document ko point kare
deliveryCompanySchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

deliveryCompanySchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports =
  El_Distributor.models["DeliveryCompany"] ||
  El_Distributor.model("DeliveryCompany", deliveryCompanySchema);