const express = require("express");
const router  = express.Router();
const { getCountries, addCountry, updateCountry, toggleCountry, deleteCountry } = require("../controllers/countryController");
const { adminOnly, protectAdmin } = require("../middleware/protectAdmin");

// branch
router.get("/",          protectAdmin, adminOnly,   getCountries);                    // Public


// admin 
router.post("/",            protectAdmin, adminOnly,   addCountry);
router.put("/:id",          protectAdmin, adminOnly,  updateCountry);
router.put("/:id/toggle",   protectAdmin, adminOnly,  toggleCountry);
router.delete("/:id",       protectAdmin, adminOnly,  deleteCountry);

module.exports = router;




