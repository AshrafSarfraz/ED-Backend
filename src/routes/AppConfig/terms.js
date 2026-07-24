const express = require("express");
const router  = express.Router();
const { adminOnly, protectAdmin } = require("../../middleware/protectAdmin");
const {
  getTerms,
  getAllTermsAdmin,
  addTerms,
  updateTerms,
} = require("../../controllers/AppConfig/terms");

// GET /api/app-config/terms        — Public (React Native)
router.get   ("/terms",      getTerms);

// GET /api/app-config/terms/all    — Admin
router.get   ("/terms/all",  protectAdmin, adminOnly, getAllTermsAdmin);

// POST /api/app-config/terms
router.post  ("/terms",      protectAdmin, adminOnly, addTerms);

// PUT /api/app-config/terms/:id
router.put   ("/terms/:id",  protectAdmin, adminOnly, updateTerms);

module.exports = router;