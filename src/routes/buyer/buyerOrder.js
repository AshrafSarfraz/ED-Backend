// const express = require("express");
// const router = express.Router();
// const { placeOrder, getMyOrders, cancelOrder, returnOrder } = require("../../controllers/buyer/buyerOrder");
// const { protectBranch } = require("../../middleware/protectBranch");

// router.post("/place",               protectBranch, placeOrder);
// router.get("/my-orders",            protectBranch, getMyOrders);
// router.put("/:orderId/cancel",     protectBranch, cancelOrder);
// router.put("/:orderId/return",     protectBranch, returnOrder);

// module.exports = router;




const express = require("express");
const router  = express.Router();
const {
  placeOrder,
  getMyOrders,
  cancelOrder,
  returnOrder,
  getMyInvoices,
} = require("../../controllers/buyer/buyerOrder");
const { protectBranch } = require("../../middleware/protectBranch");

router.post("/place",            protectBranch, placeOrder);
router.get("/my-orders",         protectBranch, getMyOrders);
router.get("/my-invoices",       protectBranch, getMyInvoices);
router.put("/:orderId/cancel",   protectBranch, cancelOrder);
router.put("/:orderId/return",   protectBranch, returnOrder);

module.exports = router;