// 📁 routes/admin/buyerPayments.js
const express = require("express");
const router  = express.Router();
const { getBuyerSummary, getBuyerInvoices, getBuyerDeliveryTracking } = require("../../controllers/admin/adminBuyerPayments");
const { protectAdmin } = require("../../middleware/protectAdmin");

router.get("/",                   protectAdmin, getBuyerSummary);           // GET /api/admin/buyer-payments
router.get("/delivery-tracking",  protectAdmin, getBuyerDeliveryTracking);  // GET /api/admin/buyer-payments/delivery-tracking
router.get("/:branchId",          protectAdmin, getBuyerInvoices);          // GET /api/admin/buyer-payments/:branchId

module.exports = router;
