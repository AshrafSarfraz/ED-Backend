const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const deliveryOrderSchema = new mongoose.Schema(
  {
    bulkOrderId:    { type: mongoose.Schema.Types.ObjectId, ref: "BulkOrder",    required: true },
    riderId:        { type: mongoose.Schema.Types.ObjectId, ref: "Rider",        default: null },
    riderCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: "RiderCompany", required: true },

    pickupLocation: {
      lat:     { type: Number, required: true },
      lng:     { type: Number, required: true },
      address: { type: String, required: true },
    },

    deliveries: [
      {
        buyerOrderId:    { type: mongoose.Schema.Types.ObjectId, ref: "BuyerOrder" },
        buyerBranchId:   { type: mongoose.Schema.Types.ObjectId, ref: "branch" },
        buyerName:       { type: String, default: null },
        buyerPhone:      { type: String, default: null },
        deliveryAddress: {
          lat:     { type: Number, default: null },
          lng:     { type: Number, default: null },
          address: { type: String, default: null },
          area:    { type: String, default: null },
          city:    { type: String, default: null },
        },
        distanceKm:     { type: Number, default: 0 },
        deliveryCharge: { type: Number, default: 0 },
        status: {
          type: String,
          enum: ["pending", "delivered", "failed"],
          default: "pending",
        },
        deliveredAt: { type: Date, default: null },
      },
    ],

    status: {
      type: String,
      enum: ["pending", "assigned", "picked_up", "at_warehouse", "completed", "failed"],
      default: "pending",
    },

    notifiedRiders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Rider" }],
    assignedAt:     { type: Date, default: null },
    pickedUpAt:     { type: Date, default: null },
    receivedAt:     { type: Date, default: null },
    completedAt:    { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["DeliveryOrder"] ||
  El_Distributor.model("DeliveryOrder", deliveryOrderSchema);