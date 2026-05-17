const express = require("express");
const router  = express.Router();

const {
  addBranch,
  completeProfile,
  approveBranch,
  branchLogin,
  getMyProfile,
  changePassword,
  getMyBranches,
  getAllBranches,
  companyDeleteBranch,
  adminDeleteBranch,
  toggleBranchActive,
  forgotPassword,
  getCompanyBranchItems,
  getBranchDetail,        // ← add karo
} = require("../controllers/branchController");

const { protectBranch }  = require("../middleware/protectBranch");
const { protectCompany } = require("../middleware/protectCompany");
const {  protectAdmin } = require("../middleware/protectAdmin");

// ─── Public ───────────────────────────────────────────────
router.post("/login",          branchLogin);
router.post("/forgot-password", forgotPassword);

// ─── Branch Protected ─────────────────────────────────────
router.get("/me",                  protectBranch, getMyProfile);
router.put("/change-password",     protectBranch, changePassword);
router.put("/profile/complete",    protectBranch, completeProfile);

// ─── Company Protected ────────────────────────────────────
router.post("/company/branches/add",                      protectCompany, addBranch);
router.get("/company/branches",                           protectCompany, getMyBranches);
router.get("/company/branches/items",                     protectCompany, getCompanyBranchItems);
router.get("/company/branches/:branchId/detail",          protectCompany, getBranchDetail); // ← add
router.delete("/company/branches/:id",                    protectCompany, companyDeleteBranch);

// ─── Admin ────────────────────────────────────────────────
router.get("/admin/branches",                       protectAdmin,       getAllBranches);
router.get("/admin/branches/:branchId/detail",      protectAdmin,       getBranchDetail); // ← add
router.put("/admin/branches/:id/approve",           protectAdmin,     approveBranch);
router.put("/admin/branches/:id/toggle",            protectAdmin,      toggleBranchActive);
router.delete("/admin/branches/:id",                protectAdmin,       adminDeleteBranch);

module.exports = router;