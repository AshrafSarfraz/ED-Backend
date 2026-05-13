const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const adminSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role:     { 
      type: String, 
      enum: ["superadmin", "admin", "user"], 
      default: "admin" 
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["Admin"] ||
  El_Distributor.model("Admin", adminSchema);