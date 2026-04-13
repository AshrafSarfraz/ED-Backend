const express = require("express");
const router  = express.Router();
const multer  = require("multer");

const {
  addPlatformItem,
  getPlatformItems,
  getSinglePlatformItem,
  updatePlatformItem,
  togglePlatformItem,
  deletePlatformItem,
} = require("../controllers/platformItemController");

// const adminAuth = require("../middleware/adminAuth");

// Multer — memory storage (Firebase upload ke liye)
const upload = multer({ storage: multer.memoryStorage() });

// ─── Public ───────────────────────────────────────────────
router.get("/",    getPlatformItems);      // GET /api/items
router.get("/:id", getSinglePlatformItem); // GET /api/items/:id

// ─── Admin Only ───────────────────────────────────────────
router.post("/",           upload.single("image"), addPlatformItem);
router.put("/:id",         upload.single("image"), updatePlatformItem);
router.put("/:id/toggle",  togglePlatformItem);
router.delete("/:id",      deletePlatformItem);

module.exports = router;
