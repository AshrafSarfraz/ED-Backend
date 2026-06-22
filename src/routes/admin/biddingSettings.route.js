// 📁 routes/admin/biddingSettings.js   (NAYA file banao)
const express = require("express");
const router  = express.Router();
const { getSettings, updateSettings } = require("../../controllers/admin/biddingSettings");
const { protectAdmin } = require("../../middleware/protectAdmin");

router.get("/bidding-settings",  protectAdmin, getSettings);
router.put("/bidding-settings",  protectAdmin, updateSettings);

module.exports = router;

