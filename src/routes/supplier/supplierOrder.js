const express = require("express");
const router  = express.Router();
const {
  getWonOrders,
  markOrderPacked,
  markAllReady,
  getBidHistory,
  handleReturn,
} = require("../../controllers/supplier/SupplierOrder");
const { protectBranch } = require("../../middleware/protectBranch");

router.get("/won",                 protectBranch, getWonOrders);
router.get("/bid-history",         protectBranch, getBidHistory);
router.put("/:buyerOrderId/pack",  protectBranch, markOrderPacked);
router.put("/:bulkOrderId/ready",  protectBranch, markAllReady);
router.put("/:orderId/return",     protectBranch, handleReturn);

module.exports = router;