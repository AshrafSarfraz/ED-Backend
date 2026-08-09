const express = require("express");
const router  = express.Router();
// Shared upload rules (config/uploadRules.js) — contract/PDC PDF ya image, max 10MB
const { uploadDocument } = require("../middleware/multer");
const upload = uploadDocument;

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
  getBranchDetail,
  uploadContract,       // ← already in controller
  uploadPdc,
  updateBranchProfile,            // ← already in controller
  saveFcmToken,
  removeFcmToken,
} = require("../controllers/branchController");

const { protectBranch }  = require("../middleware/protectBranch");
const { protectCompany } = require("../middleware/protectCompany");
const { protectAdmin }   = require("../middleware/protectAdmin");


// ─── Public ───────────────────────────────────────────────────────────────────
router.post("/login",           branchLogin);
router.post("/forgot-password", forgotPassword);

// ─── Branch Protected ─────────────────────────────────────────────────────────
router.get ("/me",               protectBranch, getMyProfile);
router.put ("/change-password",  protectBranch, changePassword);
router.put ("/profile/complete", protectBranch, completeProfile);
router.put("/profile/update", protectBranch, updateBranchProfile);

// ── Push notifications — app login pe save, logout pe remove ──
router.put   ("/fcm-token", protectBranch, saveFcmToken);
router.delete("/fcm-token", protectBranch, removeFcmToken);


// ─── Company Protected ────────────────────────────────────────────────────────
router.post  ("/company/branches/add",              protectCompany, addBranch);
router.get   ("/company/branches",                  protectCompany, getMyBranches);
router.get   ("/company/branches/items",            protectCompany, getCompanyBranchItems);
router.get   ("/company/branches/:branchId/detail", protectCompany, getBranchDetail);
router.delete("/company/branches/:id",              protectCompany, companyDeleteBranch);


// ─── Admin ────────────────────────────────────────────────────────────────────
// List + Detail
router.get("/admin/branches",                  protectAdmin, getAllBranches);
router.get("/admin/branches/:branchId/detail", protectAdmin, getBranchDetail);

// Approve / Reject
router.put("/admin/branches/:id/approve",      protectAdmin, approveBranch);

// Activate / Deactivate
router.put("/admin/branches/:id/toggle",       protectAdmin, toggleBranchActive);

// Delete
router.delete("/admin/branches/:id",           protectAdmin, adminDeleteBranch);

// ── Document Uploads (admin karta hai — account pe koi asar nahi) ─────────────
//  Contract PDF — Buyer + Supplier DONO ke liye
router.post("/admin/branches/:id/upload-contract",protectAdmin, upload.single("contract"),uploadContract);

//  PDC Image + PDC Amount — Sirf Buyer ke liye
//  Field name: "pdcImage"  |  Body: { pdcAmount: 5000 }
router.post("/admin/branches/:id/upload-pdc", protectAdmin,upload.single("pdcImage"),uploadPdc);


module.exports = router;





// const express = require("express");
// const router  = express.Router();
// const multer  = require("multer");

// // Multer — memory storage (Firebase pe direct upload)
// const upload = multer({ storage: multer.memoryStorage() });

// const {
//   addBranch,
//   completeProfile,
//   approveBranch,
//   branchLogin,
//   getMyProfile,
//   changePassword,
//   getMyBranches,
//   getAllBranches,
//   companyDeleteBranch,
//   adminDeleteBranch,
//   toggleBranchActive,
//   forgotPassword,
//   getCompanyBranchItems,
//   getBranchDetail,
//   uploadContract,       // ← already in controller
//   uploadPdc,
//   updateBranchProfile,            // ← already in controller
// } = require("../controllers/branchController");

// const { protectBranch }  = require("../middleware/protectBranch");
// const { protectCompany } = require("../middleware/protectCompany");
// const { protectAdmin }   = require("../middleware/protectAdmin");


// // ─── Public ───────────────────────────────────────────────────────────────────
// router.post("/login",           branchLogin);
// router.post("/forgot-password", forgotPassword);

// // ─── Branch Protected ─────────────────────────────────────────────────────────
// router.get ("/me",               protectBranch, getMyProfile);
// router.put ("/change-password",  protectBranch, changePassword);
// router.put ("/profile/complete", protectBranch, completeProfile);
// router.put("/profile/update", protectBranch, updateBranchProfile);


// // ─── Company Protected ────────────────────────────────────────────────────────
// router.post  ("/company/branches/add",              protectCompany, addBranch);
// router.get   ("/company/branches",                  protectCompany, getMyBranches);
// router.get   ("/company/branches/items",            protectCompany, getCompanyBranchItems);
// router.get   ("/company/branches/:branchId/detail", protectCompany, getBranchDetail);
// router.delete("/company/branches/:id",              protectCompany, companyDeleteBranch);


// // ─── Admin ────────────────────────────────────────────────────────────────────
// // List + Detail
// router.get("/admin/branches",                  protectAdmin, getAllBranches);
// router.get("/admin/branches/:branchId/detail", protectAdmin, getBranchDetail);

// // Approve / Reject
// router.put("/admin/branches/:id/approve",      protectAdmin, approveBranch);

// // Activate / Deactivate
// router.put("/admin/branches/:id/toggle",       protectAdmin, toggleBranchActive);

// // Delete
// router.delete("/admin/branches/:id",           protectAdmin, adminDeleteBranch);

// // ── Document Uploads (admin karta hai — account pe koi asar nahi) ─────────────
// //  Contract PDF — Buyer + Supplier DONO ke liye
// router.post("/admin/branches/:id/upload-contract",protectAdmin, upload.single("contract"),uploadContract);

// //  PDC Image + PDC Amount — Sirf Buyer ke liye
// //  Field name: "pdcImage"  |  Body: { pdcAmount: 5000 }
// router.post("/admin/branches/:id/upload-pdc", protectAdmin,upload.single("pdcImage"),uploadPdc);


// module.exports = router;