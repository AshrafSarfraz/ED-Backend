const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["Brand"] ||
  El_Distributor.model("Brand", brandSchema);