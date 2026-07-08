// 📁 routes/supplier/supplierDashboard.js
const express = require("express");
const router  = express.Router();
const { getSupplierDashboard } = require("../../controllers/supplier/SupplierDashboard");
const { protectBranch } = require("../../middleware/protectBranch");

router.get("/dashboard", protectBranch, getSupplierDashboard);

module.exports = router;