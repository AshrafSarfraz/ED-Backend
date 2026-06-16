// 📁 routes/delivery/auth.js
const express = require("express");
const router  = express.Router();
const { deliveryLogin, createDeliveryCompany } = require("../../controllers/riderCompany/riderAuth");

router.post("/login",    deliveryLogin);
router.post("/register", createDeliveryCompany);  // admin use (baad me protect kar sakte ho)

module.exports = router;
