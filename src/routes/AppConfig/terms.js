const express = require("express");
const router  = express.Router();

const { adminOnly, protectAdmin } = require("../../middleware/protectAdmin");

const {
  getAllTermsAdmin,
  addTerms,
  updateTerms,
} = require("../../controllers/AppConfig/terms");

// ─── Terms & Conditions ───────────────────────────────────
router.get   ("/app/terms",            getAllTermsAdmin);
router.post  ("/app/terms",            protectAdmin, adminOnly, addTerms);
router.put   ("/app/terms/:id",        protectAdmin, adminOnly, updateTerms);

module.exports = router;