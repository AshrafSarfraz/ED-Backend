const express = require("express");
const router  = express.Router();
const { adminOnly, protectAdmin } = require("../../middleware/protectAdmin");
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

// POST /api/app-config/banners
router.post  ("/banners",            protectAdmin, adminOnly, addBanner);

// PUT /api/app-config/banners/:id
router.put   ("/banners/:id",        protectAdmin, adminOnly, updateBanner);

// PUT /api/app-config/banners/:id/toggle
router.put   ("/banners/:id/toggle", protectAdmin, adminOnly, toggleBanner);

// DELETE /api/app-config/banners/:id
router.delete("/banners/:id",        protectAdmin, adminOnly, deleteBanner);

module.exports = router;