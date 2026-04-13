const express = require("express");
const router  = express.Router();

const {
  addItem,
  getMyItems,
  updateItem,
  toggleListed,
  toggleAvailable,
  deleteItem,
  adminGetAllItems,
} = require("../../controllers/supplier/supplierCatalogController");

const { protectBranch } = require("../../middleware/protectBranch");
// const adminAuth  = require("../middleware/adminAuth");

// ─── Supplier Branch ──────────────────────────────────────
router.post("/add",                     protectBranch, addItem);
router.get("/my-items",                 protectBranch, getMyItems);
router.put("/:itemId",                  protectBranch, updateItem);
router.put("/:itemId/toggle-listed",    protectBranch, toggleListed);
router.put("/:itemId/toggle-available", protectBranch, toggleAvailable);
router.delete("/:itemId",               protectBranch, deleteItem);

// ─── Admin ────────────────────────────────────────────────
router.get("/admin/all",  adminGetAllItems);

module.exports = router;
