// 📁 routes/supplier/bids.js — PROXY BIDDING
const express = require("express");
const router  = express.Router();
const {
  joinBidding,
  setMaxBid,
  getActiveBiddings,
  getMyBids,
} = require("../../controllers/supplier/bids");
const { protectBranch } = require("../../middleware/protectBranch");

router.get ("/active",  protectBranch, getActiveBiddings);
router.post("/join",    protectBranch, joinBidding);   // { bulkOrderId, maxBid? }
router.post("/max",     protectBranch, setMaxBid);     // { bulkOrderId, maxBid }  — sirf neeche
router.get ("/my-bids", protectBranch, getMyBids);

// ─── Purane endpoints — 410 Gone ──────────────────────────
//  Mobile app ka purana build abhi bhi /place ya /ignore maar sakta hai.
//  Chup-chaap 404 dene se debug mushkil hoga, isliye saaf message.
router.post("/place", protectBranch, (req, res) =>
  res.status(410).json({
    success: false,
    message: "This endpoint has been replaced. Use POST /api/supplier/bids/join to enter a bidding, then POST /api/supplier/bids/max to lower your max bid.",
  })
);
router.post("/ignore", protectBranch, (req, res) =>
  res.status(410).json({
    success: false,
    message: "Suppliers can no longer opt out once a bidding is joined. Simply do not join.",
  })
);

module.exports = router;
