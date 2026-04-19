const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

const riderSchema = new mongoose.Schema(
  {
    riderCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: "RiderCompany", required: true },
    name:           { type: String, required: true, trim: true },
    email:          { type: String, required: true, unique: true, lowercase: true },
    phone:          { type: String, required: true },
    password:       { type: String, required: true },
    vehicleType:    { type: String, enum: ["bike", "car", "van"], default: "bike" },
    vehicleNumber:  { type: String, default: null },

    currentLocation: {
      lat:       { type: Number, default: null },
      lng:       { type: Number, default: null },
      updatedAt: { type: Date,   default: null },
    },

    status:            { type: String, enum: ["online", "offline", "busy"], default: "offline" },
    isActive:          { type: Boolean, default: true },
    isPasswordChanged: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["Rider"] ||
  El_Distributor.model("Rider", riderSchema);