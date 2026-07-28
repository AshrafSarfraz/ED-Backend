const mongoose = require('mongoose');
const { Inventory } = require('../../config/db');
const { FAMILY_LIST } = require('../utils/units');

// Ingredient master me sirf core naam hai: Water, Sugar, Oil, Chilli.
// Cost yahan nahi. Unit bhi nahi - sirf family (Water -> volume),
// taake recipe me koi galti se `water 200 g` na daal de.
const ingredientSchema = new mongoose.Schema(
  {
    branch:   { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    name:     { type: String, required: true, trim: true, maxlength: 120 },
    nameKey:  { type: String, required: true },   // lowercase lookup key -> Water/WATER/water sab ek
    family:   { type: String, enum: FAMILY_LIST, required: true },  // weight | volume | count
    category: { type: String, trim: true, maxlength: 60, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ek branch me ek hi naam ka ingredient
ingredientSchema.index({ branch: 1, nameKey: 1 }, { unique: true });
ingredientSchema.index({ branch: 1, name: 1 });

module.exports = Inventory.model('Ingredient', ingredientSchema);
