const express = require("express");
const router = express.Router();
const { placeOrder, getMyOrders } = require("../../controllers/buyer/buyerOrder");
const { protectBranch } = require("../../middleware/protectBranch");

router.post("/place",     protectBranch, placeOrder);
router.get("/my-orders",  protectBranch, getMyOrders);

module.exports = router;