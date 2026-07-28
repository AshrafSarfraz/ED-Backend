const mongoose = require('mongoose');
const { Inventory } = require('../../config/db');
const { UNIT_LIST } = require('../utils/units');

// Recipe line ab free-text nahi - Ingredient master ko point karti hai
const recipeLineSchema = new mongoose.Schema(
  {
    ingredient: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
    name:       { type: String, required: true },  // display ke liye denormalized
    quantity:   { type: Number, required: true, min: 0 },
    unit:       { type: String, enum: UNIT_LIST, required: true },
  },
  { _id: false }
);

const menuItemSchema = new mongoose.Schema(
  {
    branch:   { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    name:     { type: String, required: true, trim: true, maxlength: 120 },
    nameKey:  { type: String, required: true },
    price:    { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    recipe:   { type: [recipeLineSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

menuItemSchema.index({ branch: 1, nameKey: 1 }, { unique: true });
menuItemSchema.index({ branch: 1, 'recipe.ingredient': 1 });

module.exports = Inventory.model('MenuItem', menuItemSchema);
