const PlatformItem = require("../models/PlatformItem");
const Category     = require("../models/Category");
const { uploadToFirebase } = require("../config/uploadToFirebase");

// GET /api/items — Branch only (active, protectBranch)
exports.getPlatformItems = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const filter = { isActive: true };
    if (categoryId) filter.categoryId = categoryId;

    const items = await PlatformItem.find(filter)
      .select("name image unit categoryId")
      .populate("categoryId", "name")
      .sort({ name: 1 });

    res.json({ success: true, total: items.length, data: items });
  } catch (err) {
    console.error("getPlatformItems error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/items/all — Admin only (all records + isActive)
exports.getAllItemsAdmin = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const filter = {};
    if (categoryId) filter.categoryId = categoryId;

    const items = await PlatformItem.find(filter)
      .select("name image unit categoryId isActive")
      .populate("categoryId", "name")
      .sort({ name: 1 });

    res.json({ success: true, total: items.length, data: items });
  } catch (err) {
    console.error("getAllItemsAdmin error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/items/:id — Branch
exports.getSinglePlatformItem = async (req, res) => {
  try {
    const item = await PlatformItem.findById(req.params.id).populate("categoryId", "name");
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/items — Admin
exports.addPlatformItem = async (req, res) => {
  try {
    const { name, categoryId, unit } = req.body;
    if (!name || !categoryId || !unit)
      return res.status(400).json({ success: false, message: "name, categoryId, and unit are required" });

    const category = await Category.findById(categoryId);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadToFirebase(
        req.file.buffer,
        req.file.originalname,
        `item-images/${category.name.toLowerCase()}`
      );
    }

    const item = await PlatformItem.create({ name, categoryId, unit, image: imageUrl });
    await item.populate("categoryId", "name");
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: "Item already exists" });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/items/:id — Admin
exports.updatePlatformItem = async (req, res) => {
  try {
    const { name, categoryId, unit } = req.body;
    const item = await PlatformItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    const category = await Category.findById(categoryId || item.categoryId);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    if (req.file) {
      item.image = await uploadToFirebase(
        req.file.buffer,
        req.file.originalname,
        `item-images/${category.name.toLowerCase()}`
      );
    }
    if (name)       item.name       = name;
    if (categoryId) item.categoryId = categoryId;
    if (unit)       item.unit       = unit;

    await item.save();
    await item.populate("categoryId", "name");
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/items/:id/toggle — Admin
exports.togglePlatformItem = async (req, res) => {
  try {
    const item = await PlatformItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });
    item.isActive = !item.isActive;
    await item.save();
    res.json({ success: true, data: { isActive: item.isActive } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE /api/items/:id — Admin
exports.deletePlatformItem = async (req, res) => {
  try {
    const item = await PlatformItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });
    res.json({ success: true, message: "Item deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};