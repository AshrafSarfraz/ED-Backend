const express = require("express");
const router  = express.Router();
const {
  login,
  getOrders,
  updateOrderStatus,
} = require("../../controllers/rider/riderCompany");
const { protectRiderCompany } = require("../../middleware/protectRiderCompany");

router.post("/login",                                   login);
router.get("/orders",                  protectRiderCompany, getOrders);
router.put("/orders/:deliveryOrderId/status", protectRiderCompany, updateOrderStatus);

module.exports = router;