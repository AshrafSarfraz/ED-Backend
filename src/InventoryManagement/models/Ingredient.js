const mongoose = require('mongoose');
const { Inventory } = require('../../config/db');
const { UNIT_LIST } = require('../utils/units');

const ingredientSchema = new mongoose.Schema(
  {
    branch:   { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    name:     { type: String, required: true, trim: true, maxlength: 120 },
    nameKey:  { type: String, required: true }, // lowercase lookup key
    unit:     { type: String, enum: UNIT_LIST, required: true },
    category: { type: String, trim: true, maxlength: 60, default: '' },
    // cost `unit` ke hisaab se (unit=kg -> QAR per kg)
    costPerUnit: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ek branch me ek hi naam ka ingredient
ingredientSchema.index({ branch: 1, nameKey: 1 }, { unique: true });
ingredientSchema.index({ branch: 1, name: 1 });

module.exports = Inventory.model('Ingredient', ingredientSchema);
