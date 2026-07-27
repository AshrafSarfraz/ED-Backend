const mongoose = require('mongoose');
const { Inventory } = require('../../config/db');

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, enum: ['mg', 'g', 'kg', 'ml', 'litre'], required: true },
});

const menuItemSchema = new mongoose.Schema({
  branch: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  ingredients: [ingredientSchema],
}, { timestamps: true });

module.exports = Inventory.model('MenuItem', menuItemSchema);