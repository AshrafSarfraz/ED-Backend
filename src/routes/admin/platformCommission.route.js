// 📁 routes/admin/platformCommission.route.js
const express = require("express");
const router  = express.Router();
const { getCommissionRecords } = require("../../controllers/admin/platformCommission");
const { protectAdmin } = require("../../middleware/protectAdmin");

router.get("/commission-records", protectAdmin, getCommissionRecords);

module.exports = router;
