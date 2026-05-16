// const express = require("express");
// const router = express.Router();
// const {
//   login,
//   getAllCompanies,
//   getCompany,
//   getMyProfile,
//   updateMyProfile,
//   changePassword,
//   forgotPassword,
//   deleteCompany,
//   toggleActive,
// } = require("../controllers/");

// const upload = require("../middleware/multer");
// const { protectCompany } = require("../middleware/protectCompany");
// const { adminOnly, protectAdmin } = require("../middleware/protectAdmin");

// router.patch(
//   "/me/update",
//   protectCompany,
//   upload.fields([
//     { name: "companyLogo", maxCount: 1 },
//     { name: "tradeLicenseImage", maxCount: 1 },
//     { name: "idImage", maxCount: 1 },
//   ]),
//   updateMyProfile
// );


// // Public routes
// router.post("/login", login);
// router.post("/forgot-password", forgotPassword);


// // Protected — Company admin
// router.get("/me", protectCompany, getMyProfile);
// router.patch( "/me/update", protectCompany, upload.fields([
//     { name: "companyLogo", maxCount: 1 },
//     { name: "tradeLicenseImage", maxCount: 1 },
//     { name: "idImage", maxCount: 1 },
//   ]),updateMyProfile);
// router.patch("/me/change-password", protectCompany, changePassword);



// // Admin routes
// router.get("/admin/companies",                           protectAdmin, adminOnly, getAllCompanies);
// router.get("/admin/companies/:id",                       protectAdmin, adminOnly, getCompany);
// router.put("/admin/companies/:id/approve-documents",     protectAdmin, adminOnly, approveDocument);
// router.patch("/admin/companies/:id/toggle-active",       protectAdmin, adminOnly, toggleActive);
// router.delete("/admin/companies/:id",                    protectAdmin, adminOnly, deleteCompany);  

// module.exports = router;



const express = require("express");
const router  = express.Router();
const {
  login,
  forgotPassword,
  getMyProfile,
  updateDocuments,
  changePassword,
  getAllCompanies,
  getCompany,
  approveDocuments,
  toggleActive,
  deleteCompany,
  getCompanyBranches,
} = require("../controllers/createCompany");

const upload = require("../middleware/multer");
const { protectCompany } = require("../middleware/protectCompany");
const { adminOnly, protectAdmin } = require("../middleware/protectAdmin");

// ─── Public ───────────────────────────────────────────
router.post("/login",          login);
router.post("/forgot-password", forgotPassword);

// ─── Company Protected ────────────────────────────────
router.get("/me",              protectCompany, getMyProfile);
router.patch("/me/change-password", protectCompany, changePassword);
router.patch(
  "/me/update-documents",
  protectCompany,
  upload.fields([
    { name: "companyLogo",       maxCount: 1 },
    { name: "tradeLicenseImage", maxCount: 1 },
    { name: "qidImage",          maxCount: 1 },
  ]),
  updateDocuments
);

// ─── Admin ────────────────────────────────────────────
// ─── Admin ────────────────────────────────────────────
router.get("/admin/companies",                           protectAdmin, adminOnly, getAllCompanies);
router.get("/admin/companies/:id",                       protectAdmin, adminOnly, getCompany);
router.get("/admin/companies/:id/branches",              protectAdmin, adminOnly, getCompanyBranches); // ← add karo
router.put("/admin/companies/:id/approve-documents",     protectAdmin, adminOnly, approveDocuments);
router.patch("/admin/companies/:id/toggle-active",       protectAdmin, adminOnly, toggleActive);
router.delete("/admin/companies/:id",                    protectAdmin, adminOnly, deleteCompany);

module.exports = router;