const express = require("express");
const router  = express.Router();
const { getAllBrandsAdmin, addBrand, updateBrand, deleteBrand } = require("../../controllers/masterData/brandsController");
const { adminOnly, protectAdmin } = require("../../middleware/protectAdmin");

router.get("/all",    protectAdmin, adminOnly, getAllBrandsAdmin);
router.post("/",      protectAdmin, adminOnly, addBrand);
router.put("/:id",    protectAdmin, adminOnly, updateBrand);
router.delete("/:id", protectAdmin, adminOnly, deleteBrand);

module.exports = router;