const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const systemSettingsSchema = new mongoose.Schema(
  {
    key:         { type: String, unique: true, required: true },
    value:       { type: mongoose.Schema.Types.Mixed, required: true },
    description: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["SystemSettings"] ||
  El_Distributor.model("SystemSettings", systemSettingsSchema);