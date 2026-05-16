const express    = require("express");
const router     = express.Router();
const { getDashboard } = require("../../controllers/admin/dashboard");
const { protectAdmin } = require("../../middleware/protectAdmin");

router.get("/", protectAdmin, getDashboard);

module.exports = router;