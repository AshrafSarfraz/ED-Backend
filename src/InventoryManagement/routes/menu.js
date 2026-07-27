const express = require('express');
const router = express.Router();
const MenuItem = require('../models/MenuItem');
const { protectBranch } = require('../../middleware/protectBranch');

// GET all items for logged in branch
router.get('/', protectBranch, async (req, res) => {
  try {
    const items = await MenuItem.find({ branch: req.branch._id }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ADD new item
router.post('/', protectBranch, async (req, res) => {
  try {
    const { name, price, category, ingredients } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({ message: 'Name, price and category are required' });
    }

    const item = await MenuItem.create({
      branch: req.branch._id,
      name,
      price,
      category,
      ingredients: ingredients || [],
    });

    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE item
router.delete('/:id', protectBranch, async (req, res) => {
  try {
    const item = await MenuItem.findOneAndDelete({
      _id: req.params.id,
      branch: req.branch._id,
    });

    if (!item) return res.status(404).json({ message: 'Item not found' });

    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;