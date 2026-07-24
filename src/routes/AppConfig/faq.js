const express = require("express");
const router  = express.Router();
const { adminOnly, protectAdmin } = require("../../middleware/protectAdmin");
const {
  getFaqs,
  getAllFaqsAdmin,
  addFaq,
  updateFaq,
  toggleFaq,
  deleteFaq,
} = require("../../controllers/AppConfig/faq");

// GET /api/app-config/faqs        — Public (React Native)
router.get   ("/faqs",            getFaqs);

// GET /api/app-config/faqs/all    — Admin
router.get   ("/faqs/all",        protectAdmin, adminOnly, getAllFaqsAdmin);

// POST /api/app-config/faqs
router.post  ("/faqs",            protectAdmin, adminOnly, addFaq);

// PUT /api/app-config/faqs/:id
router.put   ("/faqs/:id",        protectAdmin, adminOnly, updateFaq);

// PUT /api/app-config/faqs/:id/toggle
router.put   ("/faqs/:id/toggle", protectAdmin, adminOnly, toggleFaq);

// DELETE /api/app-config/faqs/:id
router.delete("/faqs/:id",        protectAdmin, adminOnly, deleteFaq);

module.exports = router;