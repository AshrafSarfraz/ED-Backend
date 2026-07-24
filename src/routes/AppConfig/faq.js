const express = require("express");
const router  = express.Router();

const { adminOnly, protectAdmin } = require("../../middleware/protectAdmin");

const {
  getAllFaqsAdmin,
  addFaq,
  updateFaq,
  toggleFaq,
  deleteFaq,
} = require("../../controllers/AppConfig/faq");

// ─── FAQs ─────────────────────────────────────────────────
router.get   ("/app/faqs",                 getAllFaqsAdmin);
router.post  ("/app/faqs",                 protectAdmin, adminOnly, addFaq);
router.put   ("/app/faqs/:id",             protectAdmin, adminOnly, updateFaq);
router.put   ("/app/faqs/:id/toggle",      protectAdmin, adminOnly, toggleFaq);
router.delete("/app/faqs/:id",             protectAdmin, adminOnly, deleteFaq);

module.exports = router;