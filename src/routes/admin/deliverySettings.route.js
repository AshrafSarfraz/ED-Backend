// 📁 src/routes/admin/deliverySettings.route.js
const express = require("express");
const router  = express.Router();
const { getSettings, updateSettings } = require("../../controllers/admin/deliverySettings");
const { protectAdmin } = require("../../middleware/protectAdmin");

router.get("/delivery-settings", protectAdmin, getSettings);
router.put("/delivery-settings", protectAdmin, updateSettings);

module.exports = router;
