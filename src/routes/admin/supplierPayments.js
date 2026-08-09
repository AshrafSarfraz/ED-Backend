// 📁 routes/admin/supplierPayments.js
const express = require("express");
const router  = express.Router();
const {
  getPaymentDays,
  getDayBulkOrders,
  paySupplier,
  getSupplierPaymentRecords,
} = require("../../controllers/admin/adminSupplierPayment");
const {
  getDaySuppliers,
  getSupplierDayDetail,
  exportSupplierOutstanding,
} = require("../../controllers/admin/adminSupplierOutstanding");
const { protectAdmin } = require("../../middleware/protectAdmin");

// ─── Existing (kuch nahi badla) ───────────────────────────
router.get("/days",                   protectAdmin, getPaymentDays);
router.get("/days/:date/bulk-orders", protectAdmin, getDayBulkOrders);
router.post("/pay",                   protectAdmin, paySupplier);
router.get("/suppliers",              protectAdmin, getSupplierPaymentRecords);

// ─── NEW — 3-level drill-down + export ────────────────────
//  /outstanding/export ka /days se koi conflict nahi, aur
//  /days/:date/suppliers/:branchId sabse specific hai — order safe hai.
router.get("/outstanding/export",             protectAdmin, exportSupplierOutstanding);
router.get("/days/:date/suppliers",           protectAdmin, getDaySuppliers);
router.get("/days/:date/suppliers/:branchId", protectAdmin, getSupplierDayDetail);

module.exports = router;
