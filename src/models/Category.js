const mongoose = require("mongoose");
const { El_Distributor } = require("../config/db");

const categorySchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true, unique: true },
    // e.g. Vegetables, Fruits, Dairy, Grocery, Meat, Seafood
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["Category"] ||
  El_Distributor.model("Category", categorySchema);
