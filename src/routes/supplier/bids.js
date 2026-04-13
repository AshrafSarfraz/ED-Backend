const express = require("express");
const router  = express.Router();
const { getActiveBiddings, placeBid, getMyBids } = require("../../controllers/supplier/bids");
const { protectBranch } = require("../../middleware/protectBranch");

router.get("/active",   protectBranch, getActiveBiddings);
router.post("/place",   protectBranch, placeBid);
router.get("/my-bids",  protectBranch, getMyBids);

module.exports = router;