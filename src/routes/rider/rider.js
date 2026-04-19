const express = require("express");
const router  = express.Router();
const {
  login,
  updateLocation,
  getMyOrder,
  acceptOrder,
  markPickedUp,
  markReceivedAtWarehouse,
  markDelivered,
  getHistory,
} = require("../../controllers/rider/rider");
const { protectRider } = require("../../middleware/protectRider");

router.post("/login",                                       login);
router.put("/location",                                     protectRider, updateLocation);
router.get("/my-order",                                     protectRider, getMyOrder);
router.get("/history",                                      protectRider, getHistory);
router.put("/order/:deliveryOrderId/accept",                protectRider, acceptOrder);
router.put("/order/:deliveryOrderId/pickup",                protectRider, markPickedUp);
router.put("/order/:deliveryOrderId/received",              protectRider, markReceivedAtWarehouse);
router.put("/order/:deliveryOrderId/deliver/:buyerOrderId", protectRider, markDelivered);

module.exports = router;