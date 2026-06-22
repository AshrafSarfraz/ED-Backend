// 📁 routes/admin/orders.js
const express = require("express");
const router  = express.Router();
const { getAllOrders, adminCancelOrder } = require("../../controllers/admin/adminOrders");
const { protectAdmin } = require("../../middleware/protectAdmin");

router.get("/",                protectAdmin, getAllOrders);
router.put("/:orderId/cancel", protectAdmin, adminCancelOrder);

module.exports = router;
