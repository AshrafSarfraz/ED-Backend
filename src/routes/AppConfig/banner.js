const express = require("express");
const router  = express.Router();
const { adminOnly, protectAdmin } = require("../../middleware/protectAdmin");
const upload  = require("../../middleware/multer");
const {
  getBanners,
  getAllBannersAdmin,
  addBanner,
  updateBanner,
  toggleBanner,
  deleteBanner,
} = require("../../controllers/AppConfig/banner");

// GET /api/app-config/banners        — Public (React Native)
router.get   ("/banners",            getBanners);

// GET /api/app-config/banners/all    — Admin
router.get   ("/banners/all",        protectAdmin, adminOnly, getAllBannersAdmin);

// POST /api/app-config/banners       — Admin
// multipart/form-data | optional file field: "image"
router.post  ("/banners",            protectAdmin, adminOnly, upload.single("image"), addBanner);

// PUT /api/app-config/banners/:id    — Admin
// multipart/form-data | optional file field: "image"
// Image hatane ke liye body me: removeImage = "true"
router.put   ("/banners/:id",        protectAdmin, adminOnly, upload.single("image"), updateBanner);

// PUT /api/app-config/banners/:id/toggle — Admin
router.put   ("/banners/:id/toggle", protectAdmin, adminOnly, toggleBanner);

// DELETE /api/app-config/banners/:id — Admin
router.delete("/banners/:id",        protectAdmin, adminOnly, deleteBanner);

module.exports = router;