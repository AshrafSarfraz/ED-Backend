const mongoose = require('mongoose');
const { Inventory } = require('../../config/db');

// _id = `${branchId}:${YYYYMMDD}` -> atomic $inc, koi random collision nahi
const counterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
});

module.exports = Inventory.model('Counter', counterSchema);
