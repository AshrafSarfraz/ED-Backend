// 📁 routes/admin/biddingSettings.js   (NAYA file banao)
const express = require("express");
const router  = express.Router();
const { getSettings, updateSettings } = require("../../controllers/admin/biddingSettings");
const { protectAdmin } = require("../../middleware/protectAdmin");

router.get("/bidding-settings",  protectAdmin, getSettings);
router.put("/bidding-settings",  protectAdmin, updateSettings);

module.exports = router;

// ─── Phir apni main app file (app.js / index.js / server.js) me mount karo: ───
//
//   const biddingSettingsRoute = require("./routes/admin/biddingSettings");
//   app.use("/api/admin", biddingSettingsRoute);
//
// Endpoints ban jayenge:
//   GET  /api/admin/bidding-settings
//   PUT  /api/admin/bidding-settings
