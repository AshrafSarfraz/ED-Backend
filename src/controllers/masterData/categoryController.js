const Category = require("../../models/masterData/Category");

// GET /api/categories — Branch only (active, protectBranch)
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select("name")
      .sort({ name: 1 });
    res.json({ success: true, total: categories.length, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/categories/all — Admin only (all records + isActive)
exports.getAllCategoriesAdmin = async (req, res) => {
  try {
    const categories = await Category.find()
      .select("name isActive")
      .sort({ name: 1 });
    res.json({ success: true, total: categories.length, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/categories — Admin
exports.addCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "name is required" });
    const category = await Category.create({ name });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: "Category already exists" });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/categories/:id — Admin
exports.updateCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });
    res.json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/categories/:id/toggle — Admin
exports.toggleCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });
    category.isActive = !category.isActive;
    await category.save();
    res.json({ success: true, data: { isActive: category.isActive } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE /api/categories/:id — Admin
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });
    res.json({ success: true, message: "Category deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};