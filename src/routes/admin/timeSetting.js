const express = require("express");
const router  = express.Router();
const {
  getTimeline,
  updateTimeline,
  getLateOrders,
  resolveLateOrder,
} = require("../../controllers/admin/Timesetting");

router.get("/timeline",                              getTimeline);
router.put("/timeline",                              updateTimeline);
router.get("/late-orders",                           getLateOrders);
router.put("/late-orders/:bulkOrderId/resolve",      resolveLateOrder);

module.exports = router;