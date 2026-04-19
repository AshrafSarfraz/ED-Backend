const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const riderCompanySchema = new mongoose.Schema(
  {
    name:              { type: String, required: true, trim: true },
    email:             { type: String, required: true, unique: true, lowercase: true },
    phone:             { type: String, required: true },
    password:          { type: String, required: true },
    address:           { type: String, default: null },
    isActive:          { type: Boolean, default: true },
    isPasswordChanged: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["RiderCompany"] ||
  El_Distributor.model("RiderCompany", riderCompanySchema);