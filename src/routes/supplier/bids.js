// 📁 routes/supplier/bids.js
const express = require("express");
const router  = express.Router();
const {
  getActiveBiddings,
  placeBid,
  ignoreBidding,   // ← NEW
  getMyBids,
} = require("../../controllers/supplier/bids");
const { protectBranch } = require("../../middleware/protectBranch");

router.get ("/active",   protectBranch, getActiveBiddings);
router.post("/place",    protectBranch, placeBid);
router.post("/ignore",   protectBranch, ignoreBidding);   // ← NEW
router.get ("/my-bids",  protectBranch, getMyBids);

module.exports = router;