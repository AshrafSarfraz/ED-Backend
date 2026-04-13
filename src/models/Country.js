const mongoose = require("mongoose");
const { El_Distributor } = require("../config/db");

const countrySchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true, unique: true },
    code:     { type: String, trim: true }, // e.g. PK, IN, QA
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["Country"] ||
  El_Distributor.model("Country", countrySchema);
