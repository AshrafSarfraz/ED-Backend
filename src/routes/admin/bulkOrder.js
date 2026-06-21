const express = require("express");
const router  = express.Router();
const { getBulkOrders, getBulkOrderDetail } = require("../../controllers/admin/adminBulkOrderController");
const { protectAdmin } = require("../../middleware/protectAdmin");

router.get("/",    protectAdmin, getBulkOrders);
router.get("/:bulkOrderId", protectAdmin, getBulkOrderDetail);
module.exports = router;