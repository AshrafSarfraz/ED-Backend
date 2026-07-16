// 📁 src/routes/admin/commissionSettings.route.js
const express = require("express");
const router  = express.Router();
const { getSettings, updateSettings } = require("../../controllers/admin/commissionSettings");
const { protectAdmin } = require("../../middleware/protectAdmin");

router.get("/commission-settings", protectAdmin, getSettings);
router.put("/commission-settings", protectAdmin, updateSettings);

module.exports = router;
