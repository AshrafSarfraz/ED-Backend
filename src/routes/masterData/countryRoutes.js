const express = require("express");
const router  = express.Router();
const {
  getCountries,
  getAllCountriesAdmin,
  addCountry,
  updateCountry,
  toggleCountry,
  deleteCountry,
} = require("../../controllers/masterData/countryController");
const { adminOnly, protectAdmin } = require("../../middleware/protectAdmin");
const { protectBranch }           = require("../../middleware/protectBranch");

// Admin — all records (active + inactive)
router.get("/all", protectAdmin, adminOnly, getAllCountriesAdmin);

// Branch — active only, branch token required
router.get("/", protectBranch, getCountries);

// Admin CRUD
router.post("/",          protectAdmin, adminOnly, addCountry);
router.put("/:id",        protectAdmin, adminOnly, updateCountry);
router.put("/:id/toggle", protectAdmin, adminOnly, toggleCountry);
router.delete("/:id",     protectAdmin, adminOnly, deleteCountry);

module.exports = router;