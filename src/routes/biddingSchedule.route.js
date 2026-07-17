// 📁 routes/biddingSchedule.route.js
// Public, unauthenticated — buyer/supplier mobile apps ke liye order-deadline/bidding-end time
const express = require("express");
const router  = express.Router();
const { getPublicSchedule } = require("../controllers/admin/biddingSettings");

router.get("/", getPublicSchedule);

module.exports = router;
