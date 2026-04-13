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
} = require("../controllers/branchController");

const { protectBranch }  = require("../middleware/protectBranch");
const { protectCompany } = require("../middleware/protectCompany");

// ─── Public ───────────────────────────────────────────────
router.post("/login", branchLogin);
router.post("/forgot-password", forgotPassword);

// ─── Branch Protected ─────────────────────────────────────
router.get("/me",                    protectBranch, getMyProfile);
router.put("/change-password",       protectBranch, changePassword);
router.put("/profile/complete",      protectBranch, completeProfile);


// ─── Company Protected ────────────────────────────────────
router.post("/company/branches/add",       protectCompany, addBranch);
router.get("/company/branches",            protectCompany, getMyBranches);
router.delete("/company/branches/:id",     protectCompany, companyDeleteBranch);


// ─── Admin ────────────────────────────────────────────────
router.get("/admin/branches",              getAllBranches);
router.put("/admin/branches/:id/approve",  approveBranch);
router.put("/admin/branches/:id/toggle",   toggleBranchActive);
router.delete("/admin/branches/:id",       adminDeleteBranch);

module.exports = router;