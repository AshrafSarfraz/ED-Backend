// ═══════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════



// ───────────────────────────────────────────────────────
// 📁 routes/delivery/orders.js
const express2 = require("express");
const router2  = express2.Router();
const {
  getAvailableOrders,
  getMyActiveOrders,
  getCompletedOrders,
  pickOrder,
  markOutForDelivery,
  deliverStop,
  getDeliveryOrderDetail,
} = require("../../controllers/riderCompany/riderDelivery");
const { protectDelivery } = require("../../middleware/protectRiderCompany");

router2.get ("/available",        protectDelivery, getAvailableOrders);
router2.get ("/active",           protectDelivery, getMyActiveOrders);
router2.get ("/completed",        protectDelivery, getCompletedOrders);
router2.get ("/:id",              protectDelivery, getDeliveryOrderDetail);
router2.put ("/:id/pick",         protectDelivery, pickOrder);
router2.put ("/:id/out",          protectDelivery, markOutForDelivery);
router2.put ("/:id/deliver-stop", protectDelivery, deliverStop);

module.exports = router2;


// ───────────────────────────────────────────────────────
// 📁 server.js me ADD karo:
//
//   app.use("/api/delivery/auth",   require("./src/routes/delivery/auth"));
//   app.use("/api/delivery/orders", require("./src/routes/delivery/orders"));