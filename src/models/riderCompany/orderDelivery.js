// 📁 models/rider/deliveryOrder.js
// Jab supplier "Ready for Pickup" karta hai → ye banta hai. Delivery company ise uthati hai.
const mongoose = require("mongoose");
const { El_Distributor } = require("../../config/db");

// Har buyer ke liye ek delivery stop
const deliveryStopSchema = new mongoose.Schema(
  {
    buyerOrderId:  { type: mongoose.Schema.Types.ObjectId, ref: "BuyerOrder", required: true },
    buyerBranchId: { type: mongoose.Schema.Types.ObjectId, ref: "branch",     required: true },
    buyerName:     { type: String, default: null },
    buyerPhone:    { type: String, default: null },
    quantity:      { type: Number, default: 0 },
    unit:          { type: String, default: null },
    deliveryAddress: {
      lat:     { type: Number, default: null },
      lng:     { type: Number, default: null },
      address: { type: String, default: null },
      area:    { type: String, default: null },
      city:    { type: String, default: null },
    },
    // per-stop status
    status:      { type: String, enum: ["pending", "delivered", "failed"], default: "pending" },
    deliveredAt: { type: Date, default: null },
  },
  { _id: false }
);

const deliveryOrderSchema = new mongoose.Schema(
  {
    bulkOrderId:     { type: mongoose.Schema.Types.ObjectId, ref: "BulkOrder", required: true },
    supplierBranchId:{ type: mongoose.Schema.Types.ObjectId, ref: "branch",    default: null },

    // item info (display ke liye)
    item:    { type: String, default: null },
    image:   { type: String, default: null },
    country: { type: String, default: null },
    unit:    { type: String, default: null },
    totalQuantity: { type: Number, default: 0 },

    // pickup (supplier warehouse)
    pickupLocation: {
      lat:     { type: Number, default: null },
      lng:     { type: Number, default: null },
      address: { type: String, default: null },
    },
    supplierName:  { type: String, default: null },
    supplierPhone: { type: String, default: null },

    // delivery stops (har buyer)
    deliveries: [deliveryStopSchema],

    // ─── Overall status flow ───
    // pending           → ready hua, abhi tak company ne pick nahi kiya
    // picked            → delivery company ne uthaya (rider chal pada)
    // out_for_delivery  → raaste me
    // delivered         → sab pohanch gaye
    // partially_delivered → kuch deliver, kuch fail
    status: {
      type: String,
      enum: ["pending", "picked", "out_for_delivery", "delivered", "partially_delivered"],
      default: "pending",
    },

    // ─── Timing / SLA tracking (clock based) ───
    readyAt:           { type: Date, default: null },   // supplier ne ready kiya
    supplierWasLate:   { type: Boolean, default: false },// supplier 10 AM tak ready nahi kar paya
    pickupWindowStart: { type: Date, default: null },   // 10 AM
    pickupWindowEnd:   { type: Date, default: null },   // 12 PM
    deliverDeadline:   { type: Date, default: null },   // 8 PM — buyer ke paas pohanchna chahiye
    graceDeadline:     { type: Date, default: null },   // 9 PM — uske baad pakka late
    pickedAt:          { type: Date, default: null },   // rider ne uthaya
    deliveredAt:       { type: Date, default: null },   // sab deliver hua

    // ─── Late detection ───
    isLate:        { type: Boolean, default: false },
    lateBy:        { type: String, enum: ["none", "supplier", "rider"], default: "none" },
    lateReason:    { type: String, default: null },

    deliveryCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryCompany", default: null },
  },
  { timestamps: true }
);

module.exports =
  El_Distributor.models["DeliveryOrder"] ||
  El_Distributor.model("DeliveryOrder", deliveryOrderSchema);