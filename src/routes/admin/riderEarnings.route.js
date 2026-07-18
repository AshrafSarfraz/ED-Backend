// 📁 routes/admin/riderEarnings.route.js
const express = require("express");
const router  = express.Router();
const { getEarningMonths, getEarningDetail, payRiderEarnings, getAllDebts, settleSingleDebt } = require("../../controllers/admin/riderEarnings");
const { protectAdmin } = require("../../middleware/protectAdmin");

router.get ("/months",              protectAdmin, getEarningMonths);
router.get ("/debts",               protectAdmin, getAllDebts);          // must come before /:month/:companyId
router.put ("/debts/:entryId/settle", protectAdmin, settleSingleDebt);
router.post("/pay",                 protectAdmin, payRiderEarnings);
router.get ("/:month/:companyId",   protectAdmin, getEarningDetail);

module.exports = router;