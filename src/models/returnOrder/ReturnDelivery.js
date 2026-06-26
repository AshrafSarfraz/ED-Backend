// 📁 models/ReturnDelivery.js
// Jab supplier guilty → return delivery (buyer → supplier)
const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const returnDeliverySchema = new mongoose.Schema(
  {
    returnOrderId:     { type: mongoose.Schema.Types.ObjectId, ref: "ReturnOrder",     required: true },
    deliveryCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryCompany", default: null },
    buyerBranchId:     { type: mongoose.Schema.Types.ObjectId, ref: "branch",          required: true },
    supplierBranchId:  { type: mongoose.Schema.Types.ObjectId, ref: "branch",          required: true },

    pickupAddress: { // buyer ka address
      lat:     { type: Number, default: null },
      lng:     { type: Number, default: null },
      address: { type: String, default: null },
    },
    dropAddress: { // supplier ka address
      lat:     { type: Number, default: null },
      lng:     { type: Number, default: null },
      address: { type: String, default: null },
    },

    // pending → picked → delivered_to_supplier
    status: {
      type: String,
      enum: ["pending", "picked", "delivered_to_supplier"],
      default: "pending",
    },
    pickedAt:    { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["ReturnDelivery"] ||
  El_Distributor.model("ReturnDelivery", returnDeliverySchema);
