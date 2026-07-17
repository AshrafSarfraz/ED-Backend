// 📁 routes/admin/riderEarnings.route.js
const express = require("express");
const router  = express.Router();
const { getEarningMonths, getEarningDetail, payRiderEarnings } = require("../../controllers/admin/riderEarnings");
const { protectAdmin } = require("../../middleware/protectAdmin");

router.get ("/months",              protectAdmin, getEarningMonths);
router.get ("/:month/:companyId",   protectAdmin, getEarningDetail);
router.post("/pay",                 protectAdmin, payRiderEarnings);

module.exports = router;
