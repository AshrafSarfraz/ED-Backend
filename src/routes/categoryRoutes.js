const express = require("express");
const router  = express.Router();
const { getCategories, addCategory, updateCategory, toggleCategory, deleteCategory } = require("../controllers/categoryController");

// branch 
router.get("/",             getCategories);                   // Public


// admin
router.post("/",             addCategory);
router.put("/:id",           updateCategory);
router.put("/:id/toggle",    toggleCategory);
router.delete("/:id",        deleteCategory);

module.exports = router;
