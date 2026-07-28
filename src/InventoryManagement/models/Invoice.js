const mongoose = require('mongoose');
const { Inventory } = require('../../config/db');
const { UNIT_LIST } = require('../utils/units');

// Sale ke waqt ki recipe ka SNAPSHOT. Baad me recipe badle to purani report nahi badlegi.
const snapLineSchema = new mongoose.Schema(
  {
    ingredient:   { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
    name:         { type: String, required: true },
    quantity:     { type: Number, required: true, min: 0 },  // recipe line ki apni unit me
    unit:         { type: String, enum: UNIT_LIST, required: true },
    baseQuantity: { type: Number, required: true, min: 0 },  // g / ml / pcs me
    baseUnit:     { type: String, required: true },
  },
  { _id: false }
);

const invoiceItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name:     { type: String, required: true },
    price:    { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
    recipe:   { type: [snapLineSchema], default: [] },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    branch:        { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    invoiceNumber: { type: String, required: true },
    customerName:  { type: String, required: true, trim: true, maxlength: 120 },
    items:         { type: [invoiceItemSchema], required: true },
    tax:           { type: Number, default: 0, min: 0, max: 100 },  // percent
    taxAmount:     { type: Number, default: 0, min: 0 },
    subtotal:      { type: Number, required: true, min: 0 },
    totalAmount:   { type: Number, required: true, min: 0 },
    createdBy:     { type: mongoose.Schema.Types.ObjectId },
  },
  { timestamps: true }
);

// per-branch unique (pehle global tha - dusri branch block ho jati thi)
invoiceSchema.index({ branch: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ branch: 1, createdAt: -1 });

module.exports = Inventory.model('Invoice', invoiceSchema);
