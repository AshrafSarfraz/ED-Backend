// 📁 routes/buyer/order.js   (ya jo bhi tumhara buyer order route file hai)
const express = require("express");
const router  = express.Router();
const {
  placeOrder,
  getMyOrders,
  getOrderBiddingStatus,   // ← NEW
  cancelOrder,
  returnOrder,
  getMyInvoices,
  getOrderTracking,
} = require("../../controllers/buyer/buyerOrder");
const { protectBranch } = require("../../middleware/protectBranch");

router.post("/place",                       protectBranch, placeOrder);
router.get("/my-orders",                    protectBranch, getMyOrders);
router.get("/my-invoices",                  protectBranch, getMyInvoices);
router.get("/:orderId/bidding-status",      protectBranch, getOrderBiddingStatus);  // ← NEW
router.put("/:orderId/cancel",              protectBranch, cancelOrder);
router.get("/:orderId/tracking",            protectBranch, getOrderTracking);
router.put("/:orderId/return",              protectBranch, returnOrder);

module.exports = router;