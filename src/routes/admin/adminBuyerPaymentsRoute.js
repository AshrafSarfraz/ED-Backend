// 📁 routes/admin/buyerPayments.js
const express = require("express");
const router  = express.Router();
const { getBuyerSummary, getBuyerInvoices } = require("../../controllers/admin/adminBuyerPayments");
const { protectAdmin } = require("../../middleware/protectAdmin");

router.get("/",           protectAdmin, getBuyerSummary);    // GET /api/admin/buyer-payments
router.get("/:branchId",  protectAdmin, getBuyerInvoices);   // GET /api/admin/buyer-payments/:branchId

module.exports = router;
