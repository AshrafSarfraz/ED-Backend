const express = require("express");
const router  = express.Router();
const { 
  getBulkOrders, 
  getBulkOrderDetail,
  getSupplierPerformance,  // ← add karo
} = require("../../controllers/admin/adminBulkOrderController");
const { protectAdmin } = require("../../middleware/protectAdmin");

router.get("/supplier-performance", protectAdmin, getSupplierPerformance); // ← pehle
router.get("/",                     protectAdmin, getBulkOrders);
router.get("/:bulkOrderId",         protectAdmin, getBulkOrderDetail);

module.exports = router;