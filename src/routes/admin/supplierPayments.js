// 📁 routes/admin/supplierPayments.js
const express = require("express");
const router  = express.Router();
const {
  getPaymentDays,
  getDayBulkOrders,
  paySupplier,
  getSupplierPaymentRecords,
} = require("../../controllers/admin/adminSupplierPayment");
const { protectAdmin } = require("../../middleware/protectAdmin");

router.get("/days",                   protectAdmin, getPaymentDays);
router.get("/days/:date/bulk-orders", protectAdmin, getDayBulkOrders);
router.post("/pay",                   protectAdmin, paySupplier);
router.get("/suppliers",              protectAdmin, getSupplierPaymentRecords);

module.exports = router;
