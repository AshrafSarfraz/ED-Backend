// 📁 routes/admin/buyerOutstanding.route.js
// Mount: app.use("/api/admin/buyer-outstanding", ...)
// Purana /api/admin/buyer-payments alag hai aur bilkul untouched hai.
const express = require("express");
const router  = express.Router();
const {
  getBuyerDays,
  getDayBuyers,
  getBuyerDayDetail,
  exportBuyerOutstanding,
} = require("../../controllers/admin/adminBuyerOutstanding");
const { protectAdmin } = require("../../middleware/protectAdmin");

router.get("/export",                      protectAdmin, exportBuyerOutstanding);
router.get("/days",                        protectAdmin, getBuyerDays);
router.get("/days/:date/buyers",           protectAdmin, getDayBuyers);
router.get("/days/:date/buyers/:branchId", protectAdmin, getBuyerDayDetail);

module.exports = router;
