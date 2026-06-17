// const express = require("express");
// const router  = express.Router();
// const {
//   getWonOrders,
//   markOrderPacked,
//   markAllReady,
//   getBidHistory,
//   handleReturn,
// } = require("../../controllers/supplier/SupplierOrder");
// const { protectBranch } = require("../../middleware/protectBranch");

// router.get("/won",                 protectBranch, getWonOrders);
// router.get("/bid-history",         protectBranch, getBidHistory);
// router.put("/:buyerOrderId/pack",  protectBranch, markOrderPacked);
// router.put("/:bulkOrderId/ready",  protectBranch, markAllReady);
// router.put("/:orderId/return",     protectBranch, handleReturn);

// module.exports = router;





const express = require("express");
const router  = express.Router();
const {
  getWonOrders,
  markOrderPacked,
  markAllPacked,
  markAllReady,
  getBidHistory,
  handleReturn,
  getOrderHistory, 
  getSupplierTracking
} = require("../../controllers/supplier/SupplierOrder");
const { protectBranch } = require("../../middleware/protectBranch");

router.get("/won",                    protectBranch, getWonOrders);
router.get("/bid-history",            protectBranch, getBidHistory);
router.get("/history", protectBranch, getOrderHistory);
router.put("/:buyerOrderId/pack",     protectBranch, markOrderPacked);
router.put("/:bulkOrderId/pack-all",  protectBranch, markAllPacked);
router.put("/:bulkOrderId/ready",     protectBranch, markAllReady);
router.get("/:bulkOrderId/tracking", protectBranch, getSupplierTracking);
router.put("/:orderId/return",        protectBranch, handleReturn);

module.exports = router;