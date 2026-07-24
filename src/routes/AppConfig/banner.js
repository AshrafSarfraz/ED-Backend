const express = require("express");
const router  = express.Router();

const { adminOnly, protectAdmin } = require("../../middleware/protectAdmin");

const {
  getAllBannersAdmin,
  addBanner,
  updateBanner,
  toggleBanner,
  deleteBanner,
} = require("../../controllers/AppConfig/banner");


// ─── Banners ──────────────────────────────────────────────
router.get   ("/app/banners",             getAllBannersAdmin);
router.post  ("/app/banners",             protectAdmin, adminOnly, addBanner);
router.put   ("/app/banners/:id",         protectAdmin, adminOnly, updateBanner);
router.put   ("/app/banners/:id/toggle",  protectAdmin, adminOnly, toggleBanner);
router.delete("/app/banners/:id",         protectAdmin, adminOnly, deleteBanner);

module.exports = router;