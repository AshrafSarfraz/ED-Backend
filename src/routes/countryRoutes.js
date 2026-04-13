const express = require("express");
const router  = express.Router();
const { getCountries, addCountry, updateCountry, toggleCountry, deleteCountry } = require("../controllers/countryController");

// branch
router.get("/",             getCountries);                    // Public


// admin 
router.post("/",             addCountry);
router.put("/:id",           updateCountry);
router.put("/:id/toggle",    toggleCountry);
router.delete("/:id",      deleteCountry);

module.exports = router;
