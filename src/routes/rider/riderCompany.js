const express = require("express");
const router  = express.Router();
const { login, addRider, getMyRiders, getDashboard } = require("../../controllers/rider/ridercompany");
const { protectRiderCompany } = require("../../middleware/protectRiderCompany");

router.post("/login",        login);
router.post("/riders/add",   protectRiderCompany, addRider);
router.get("/riders",        protectRiderCompany, getMyRiders);
router.get("/dashboard",     protectRiderCompany, getDashboard);

module.exports = router;