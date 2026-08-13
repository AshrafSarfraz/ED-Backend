const express = require("express");
const router  = express.Router();
const {
  getTimeline,
  updateTimeline,
  getLateOrders,
  resolveLateOrder,
} = require("../../controllers/admin/Timesetting");
const { protectAdmin, adminOnly } = require("../../middleware/protectAdmin");

// ⚠️ SECURITY FIX — ye chaaron routes pehle BILKUL open the.
//    Koi bhi bina token ke PUT /api/admin/settings/timeline maar ke
//    bidding ki timings badal sakta tha.
router.get("/timeline",                          protectAdmin, adminOnly, getTimeline);
router.put("/timeline",                          protectAdmin, adminOnly, updateTimeline);
router.get("/late-orders",                       protectAdmin, adminOnly, getLateOrders);
router.put("/late-orders/:bulkOrderId/resolve",  protectAdmin, adminOnly, resolveLateOrder);

module.exports = router;
