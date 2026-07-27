const mongoose = require('mongoose');
const { Inventory } = require('../../config/db');

const invoiceItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  subtotal: { type: Number, required: true },
});

const invoiceSchema = new mongoose.Schema({
  branch: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  invoiceNumber: { type: String, unique: true },
  customerName: { type: String, required: true },
  items: [invoiceItemSchema],
  tax: { type: Number, default: 0 },
  subtotal: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
}, { timestamps: true });

module.exports = Inventory.model('Invoice', invoiceSchema);