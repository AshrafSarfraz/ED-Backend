const express = require("express");
const router  = express.Router();
const { getCategories, addCategory, updateCategory, toggleCategory, deleteCategory } = require("../controllers/categoryController");
const { adminOnly, protectAdmin } = require("../middleware/protectAdmin");


// branch 
router.get("/",                 getCategories);                   // Public


// admin
router.post("/",           protectAdmin, adminOnly,     addCategory);
router.put("/:id",         protectAdmin, adminOnly,    updateCategory);
router.put("/:id/toggle",  protectAdmin, adminOnly,   toggleCategory);
router.delete("/:id",      protectAdmin, adminOnly,   deleteCategory);

module.exports = router;
