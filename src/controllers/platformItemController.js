const PlatformItem = require("../models/PlatformItem");
const Category = require("../models/Category");
const { uploadToFirebase } = require("../config/uploadToFirebase");

// ═══════════════════════════════════════════════════════════
//  ADMIN — Add Platform Item
//  POST /api/items
//  Auth: Admin
//  Body: name, categoryId, unit
//  File: image
// ═══════════════════════════════════════════════════════════
exports.addPlatformItem = async (req, res) => {
  try {
    const { name, categoryId, unit } = req.body;

    if (!name || !categoryId || !unit) {
      return res.status(400).json({
        success: false,
        message: "name, categoryId, and unit are required",
      });
    }

    // Check category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    let imageUrl = null;

    // Upload image to Firebase — folder: item-images/{categoryName}/
    if (req.file) {
      imageUrl = await uploadToFirebase(
        req.file.buffer,
        req.file.originalname,
        `item-images/${category.name.toLowerCase()}`
        // e.g. item-images/vegetables/tomato.jpg
      );
    }

    const item = await PlatformItem.create({
      name,
      categoryId,
      unit,
      image: imageUrl,
    });

    await item.populate("categoryId", "name");

    res.status(201).json({
      success: true,
      message: "Item added successfully",
      data: item,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Item already exists" });
    }
    console.error("addPlatformItem error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  GET ALL ITEMS
//  GET /api/items
//  GET /api/items?categoryId=xxx  ← category wise filter
//  Public
// ═══════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════
//  GET SINGLE ITEM
//  GET /api/items/:id
//  Public
// ═══════════════════════════════════════════════════════════
exports.getSinglePlatformItem = async (req, res) => {
  try {
    const item = await PlatformItem.findById(req.params.id)
      .populate("categoryId", "name");

    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    res.json({ success: true, data: item });
  } catch (err) {
    console.error("getSinglePlatformItem error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  ADMIN — Update Item
//  PUT /api/items/:id
//  Auth: Admin
// ═══════════════════════════════════════════════════════════
exports.updatePlatformItem = async (req, res) => {
  try {
    const { name, categoryId, unit } = req.body;

    const item = await PlatformItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    // Get category for Firebase folder name
    const category = await Category.findById(categoryId || item.categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // Upload new image if provided
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
    console.error("updatePlatformItem error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  ADMIN — Toggle Active
//  PUT /api/items/:id/toggle
//  Auth: Admin
// ═══════════════════════════════════════════════════════════
exports.togglePlatformItem = async (req, res) => {
  try {
    const item = await PlatformItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    item.isActive = !item.isActive;
    await item.save();

    res.json({
      success: true,
      message: `Item ${item.isActive ? "activated" : "deactivated"}`,
      data: { isActive: item.isActive },
    });
  } catch (err) {
    console.error("togglePlatformItem error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  ADMIN — Delete Item
//  DELETE /api/items/:id
//  Auth: Admin
// ═══════════════════════════════════════════════════════════
exports.deletePlatformItem = async (req, res) => {
  try {
    const item = await PlatformItem.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    res.json({ success: true, message: "Item deleted successfully" });
  } catch (err) {
    console.error("deletePlatformItem error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
