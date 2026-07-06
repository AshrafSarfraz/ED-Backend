const express = require("express");
const router  = express.Router();
const {
  getCategories,
  getAllCategoriesAdmin,
  addCategory,
  updateCategory,
  toggleCategory,
  deleteCategory,
} = require("../../controllers/masterData/categoryController");
const { adminOnly, protectAdmin } = require("../../middleware/protectAdmin");
const { protectBranch }           = require("../../middleware/protectBranch");

// Admin — all records
router.get("/all", protectAdmin, adminOnly, getAllCategoriesAdmin);

// Branch — active only, branch token required
router.get("/", protectBranch, getCategories);

// Admin CRUD
router.post("/",          protectAdmin, adminOnly, addCategory);
router.put("/:id",        protectAdmin, adminOnly, updateCategory);
router.put("/:id/toggle", protectAdmin, adminOnly, toggleCategory);
router.delete("/:id",     protectAdmin, adminOnly, deleteCategory);

module.exports = router;