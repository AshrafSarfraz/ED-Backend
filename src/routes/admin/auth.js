const express = require("express");
const router  = express.Router();
const {
  setup,
  createAdmin,
  login,
  getMe,
  changePassword,
  forgotPassword,
  getAllAdmins,
  updateAdmin,
  deleteAdmin,
  toggleAdmin,
} = require("../../controllers/admin/auth");
const { protectAdmin, superAdminOnly } = require("../../middleware/protectAdmin");

// Public
router.post("/setup",           setup);
router.post("/login",           login);
router.post("/forgot-password", forgotPassword);

// Protected — all admins
router.get("/me",              protectAdmin, getMe);
router.put("/change-password", protectAdmin, changePassword);

// Protected — SuperAdmin only
router.post("/create",         protectAdmin, superAdminOnly, createAdmin);
router.get("/all",             protectAdmin, superAdminOnly, getAllAdmins);
router.put("/:id",             protectAdmin, superAdminOnly, updateAdmin);
router.delete("/:id",          protectAdmin, superAdminOnly, deleteAdmin);
router.put("/:id/toggle",      protectAdmin, superAdminOnly, toggleAdmin);

module.exports = router;