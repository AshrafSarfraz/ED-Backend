const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const deliverySlabSchema = new mongoose.Schema(
  {
    minKm:     { type: Number, required: true },
    maxKm:     { type: Number, required: true },
    ratePerKm: { type: Number, required: true },
    isActive:  { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["DeliverySlab"] ||
  El_Distributor.model("DeliverySlab", deliverySlabSchema);