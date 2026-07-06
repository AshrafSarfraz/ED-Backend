const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const {
  addPlatformItem,
  getPlatformItems,
  getAllItemsAdmin,
  getSinglePlatformItem,
  updatePlatformItem,
  togglePlatformItem,
  deletePlatformItem,
} = require("../../controllers/masterData/platformItemController");
const { adminOnly, protectAdmin } = require("../../middleware/protectAdmin");
const { protectBranch }           = require("../../middleware/protectBranch");

const upload = multer({ storage: multer.memoryStorage() });

// Admin — all records (active + inactive)
router.get("/all", protectAdmin, adminOnly, getAllItemsAdmin);

// Branch — active only, branch token required
router.get("/",    protectBranch, getPlatformItems);
router.get("/:id", protectBranch, getSinglePlatformItem);

// Admin CRUD
router.post("/",          protectAdmin, adminOnly, upload.single("image"), addPlatformItem);
router.put("/:id",        protectAdmin, adminOnly, upload.single("image"), updatePlatformItem);
router.put("/:id/toggle", protectAdmin, adminOnly, togglePlatformItem);
router.delete("/:id",     protectAdmin, adminOnly, deletePlatformItem);

module.exports = router;