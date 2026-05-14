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
const { adminOnly, protectAdmin } = require("../middleware/protectAdmin");

// const adminAuth = require("../middleware/adminAuth");

// Multer — memory storage (Firebase upload ke liye)
const upload = multer({ storage: multer.memoryStorage() });

// ─── Public ───────────────────────────────────────────────
router.get("/",    getPlatformItems);      // GET /api/items
router.get("/:id", getSinglePlatformItem); // GET /api/items/:id

// ─── Admin Only ───────────────────────────────────────────
router.post("/",            protectAdmin, adminOnly,     upload.single("image"), addPlatformItem);
router.put("/:id",          protectAdmin, adminOnly,       upload.single("image"), updatePlatformItem);
router.put("/:id/toggle",   protectAdmin, adminOnly,   togglePlatformItem);
router.delete("/:id",       protectAdmin, adminOnly,   deletePlatformItem);

module.exports = router;
