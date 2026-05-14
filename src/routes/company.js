const express = require("express");
const router = express.Router();
const {
  login,
  getAllCompanies,
  getCompany,
  getMyProfile,
  updateMyProfile,
  changePassword,
  forgotPassword,
  deleteCompany,
  toggleActive,
} = require("../controllers/company");

const upload = require("../middleware/multer");
const { protectCompany } = require("../middleware/protectCompany");
const { adminOnly, protectAdmin } = require("../middleware/protectAdmin");

router.patch(
  "/me/update",
  protectCompany,
  upload.fields([
    { name: "companyLogo", maxCount: 1 },
    { name: "tradeLicenseImage", maxCount: 1 },
    { name: "idImage", maxCount: 1 },
  ]),
  updateMyProfile
);


// Public routes
router.post("/login", login);
router.post("/forgot-password", forgotPassword);


// Protected — Company admin
router.get("/me", protectCompany, getMyProfile);
router.patch( "/me/update", protectCompany, upload.fields([
    { name: "companyLogo", maxCount: 1 },
    { name: "tradeLicenseImage", maxCount: 1 },
    { name: "idImage", maxCount: 1 },
  ]),updateMyProfile);
router.patch("/me/change-password", protectCompany, changePassword);



// Admin routes
router.get("/admin/companies",                        protectAdmin, adminOnly,  getAllCompanies);
router.get("/admin/companies/:id",                    protectAdmin, adminOnly,  getCompany);
router.delete("/admin/companies/:id",                 protectAdmin, adminOnly,  deleteCompany);
router.patch("/admin/companies/:id/toggle-active",    protectAdmin, adminOnly,  toggleActive);   

module.exports = router;