const mongoose = require('mongoose');
const { Inventory } = require('../../config/db');
const { UNIT_LIST } = require('../utils/units');

// Ingredient master me sirf core naam + unit: "Water ml", "Chicken g", "Chilli g".
// Cost yahan nahi. Recipe me quantity is unit ke saath aati hai (ya usi family ki
// doosri unit - Water ml hai to litre chalega, `g` nahi).
const ingredientSchema = new mongoose.Schema(
  {
    branch:   { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    name:     { type: String, required: true, trim: true, maxlength: 120 },
    nameKey:  { type: String, required: true },   // lowercase key -> Water/WATER/water sab ek
    unit:     { type: String, enum: UNIT_LIST, required: true },
    category: { type: String, trim: true, maxlength: 60, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ek branch me ek hi naam ka ingredient
ingredientSchema.index({ branch: 1, nameKey: 1 }, { unique: true });
ingredientSchema.index({ branch: 1, name: 1 });

module.exports = Inventory.model('Ingredient', ingredientSchema);
