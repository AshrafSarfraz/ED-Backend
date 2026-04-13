const express = require("express");
const { getCatalogItems } = require("../../controllers/buyer/catalog");
const router = express.Router();
const { protectBranch }  = require("../../middleware/protectBranch");

router.get("/", protectBranch, getCatalogItems);

module.exports = router;