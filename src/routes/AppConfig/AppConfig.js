const express = require("express");
const router  = express.Router();

const { adminOnly, protectAdmin } = require("../../middleware/protectAdmin");

const {
  getAllBannersAdmin,
  addBanner,
  updateBanner,
  toggleBanner,
  deleteBanner,
} = require("../../controllers/appConfig/bannerController");

const {
  getAllFaqsAdmin,
  addFaq,
  updateFaq,
  toggleFaq,
  deleteFaq,
} = require("../../controllers/appConfig/faqController");

const {
  getAllTermsAdmin,
  addTerms,
  updateTerms,
} = require("../../controllers/appConfig/termsController");

// ─── Banners ──────────────────────────────────────────────
router.get   ("/app/banners",          protectAdmin, adminOnly, getAllBannersAdmin);
router.post  ("/app/banners",          protectAdmin, adminOnly, addBanner);
router.put   ("/app/banners/:id",      protectAdmin, adminOnly, updateBanner);
router.put   ("/app/banners/:id/toggle", protectAdmin, adminOnly, toggleBanner);
router.delete("/app/banners/:id",      protectAdmin, adminOnly, deleteBanner);

// ─── FAQs ─────────────────────────────────────────────────
router.get   ("/app/faqs",             protectAdmin, adminOnly, getAllFaqsAdmin);
router.post  ("/app/faqs",             protectAdmin, adminOnly, addFaq);
router.put   ("/app/faqs/:id",         protectAdmin, adminOnly, updateFaq);
router.put   ("/app/faqs/:id/toggle",  protectAdmin, adminOnly, toggleFaq);
router.delete("/app/faqs/:id",         protectAdmin, adminOnly, deleteFaq);

// ─── Terms & Conditions ───────────────────────────────────
router.get   ("/app/terms",            protectAdmin, adminOnly, getAllTermsAdmin);
router.post  ("/app/terms",            protectAdmin, adminOnly, addTerms);
router.put   ("/app/terms/:id",        protectAdmin, adminOnly, updateTerms);

module.exports = router;