// 📁 routes/admin/profiles.route.js
const express = require("express");
const router  = express.Router();
const { getBuyerProfile }    = require("../../controllers/admin/buyerProfile");
const { getSupplierProfile } = require("../../controllers/admin/supplierProfile");
const { protectAdmin } = require("../../middleware/protectAdmin");

router.get("/buyer-profile/:branchId",    protectAdmin, getBuyerProfile);
router.get("/supplier-profile/:branchId", protectAdmin, getSupplierProfile);

module.exports = router;
