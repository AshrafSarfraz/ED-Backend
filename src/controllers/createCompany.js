const Company      = require("../models/createCompany");
const bcrypt       = require("bcryptjs");
const jwt          = require("jsonwebtoken");
const generateTempPassword = require("../utils/generatePassword");
const { uploadToFirebase } = require("../config/uploadToFirebase");
const {
  sendForgotPasswordEmail,
  sendCompanyDocumentEmail,
} = require("../utils/sendEmail");

// ═══════════════════════════════════════════════════════
//  COMPANY — Login
//  POST /api/company/login
// ═══════════════════════════════════════════════════════
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const company = await Company.findOne({ email });
    if (!company) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (!company.isActive) {
      return res.status(403).json({ success: false, message: "Account deactivated" });
    }

    const isMatch = await bcrypt.compare(password, company.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: company._id, type: "company" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      data: {
        _id:               company._id,
        brandName:         company.brandName,
        email:             company.email,
        accountType:       company.accountType,
        isPasswordChanged: company.isPasswordChanged,
        companyLogo:       company.companyLogo,
        documentsStatus:   company.documentsStatus,
      },
    });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  COMPANY — Forgot Password
//  POST /api/company/forgot-password
// ═══════════════════════════════════════════════════════
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    const company = await Company.findOne({ email });
    if (!company) {
      return res.status(404).json({ success: false, message: "No account found" });
    }

    const newTempPassword  = generateTempPassword();
    company.password       = await bcrypt.hash(newTempPassword, 10);
    company.isPasswordChanged = false;
    await company.save();

    await sendForgotPasswordEmail({
      toEmail:      company.email,
      brandName:    company.brandName,
      tempPassword: newTempPassword,
    });

    res.json({ success: true, message: "New password sent to your email" });
  } catch (err) {
    console.error("forgotPassword error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  COMPANY — Get My Profile
//  GET /api/company/me
// ═══════════════════════════════════════════════════════
exports.getMyProfile = async (req, res) => {
  try {
    const company = await Company.findById(req.company._id).select("-password");
    res.json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  COMPANY — Update Documents
//  PATCH /api/company/me/update-documents
// ═══════════════════════════════════════════════════════
exports.updateDocuments = async (req, res) => {
  try {
    const company    = await Company.findById(req.company._id);
    const updateData = {};

    const { tradeLicenseExpiry, qidExpiry } = req.body;

    // Company Logo
    if (req.files?.companyLogo) {
      const file = req.files.companyLogo[0];
      updateData.companyLogo = await uploadToFirebase(
        file.buffer, file.originalname, `company-logos/${company._id}`
      );
    }

    // Trade License
    if (req.files?.tradeLicenseImage) {
      const file = req.files.tradeLicenseImage[0];
      updateData.tradeLicenseImage  = await uploadToFirebase(
        file.buffer, file.originalname, `trade-licenses/${company._id}`
      );
      updateData.tradeLicenseStatus = "submitted";
    }
    if (tradeLicenseExpiry) {
      updateData.tradeLicenseExpiry = new Date(tradeLicenseExpiry);
    }

    // QID
    if (req.files?.qidImage) {
      const file = req.files.qidImage[0];
      updateData.qidImage  = await uploadToFirebase(
        file.buffer, file.originalname, `qid-images/${company._id}`
      );
      updateData.qidStatus = "submitted";
    }
    if (qidExpiry) {
      updateData.qidExpiry = new Date(qidExpiry);
    }

    // Overall status check
    const tlStatus  = updateData.tradeLicenseStatus || company.tradeLicenseStatus;
    const qidStatus = updateData.qidStatus          || company.qidStatus;

    const tlDone  = ["submitted", "approved"].includes(tlStatus);
    const qidDone = ["submitted", "approved"].includes(qidStatus);

    if (tlDone && qidDone) {
      updateData.documentsStatus           = "submitted";
      updateData.documentsRejectionReason  = null;
    }

    const updated = await Company.findByIdAndUpdate(
      company._id,
      updateData,
      { new: true }
    ).select("-password");

    res.json({
      success: true,
      message: "Documents submitted. Waiting for admin approval.",
      data:    updated,
    });
  } catch (err) {
    console.error("updateDocuments error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  COMPANY — Change Password
//  PATCH /api/company/me/change-password
// ═══════════════════════════════════════════════════════
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Both fields required" });
    }

    const company = await Company.findById(req.company._id);
    const isMatch = await bcrypt.compare(currentPassword, company.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password incorrect" });
    }

    company.password          = await bcrypt.hash(newPassword, 10);
    company.isPasswordChanged = true;
    await company.save();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    console.error("changePassword error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Get All Companies
//  GET /api/company/admin/companies
// ═══════════════════════════════════════════════════════
exports.getAllCompanies = async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive, documentsStatus, accountType } = req.query;
    const filter = {};

    if (isActive        !== undefined) filter.isActive        = isActive === "true";
    if (documentsStatus)               filter.documentsStatus = documentsStatus;
    if (accountType)                   filter.accountType     = accountType;

    const skip  = (page - 1) * limit;
    const total = await Company.countDocuments(filter);

    const companies = await Company.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      total,
      page:  Number(page),
      pages: Math.ceil(total / limit),
      data:  companies,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Get Single Company
//  GET /api/company/admin/companies/:id
// ═══════════════════════════════════════════════════════
exports.getCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).select("-password");
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    res.json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Approve/Reject Documents
//  PUT /api/company/admin/companies/:id/approve-documents
// ═══════════════════════════════════════════════════════
exports.approveDocuments = async (req, res) => {
  try {
    const { action, reason, tradeLicenseExpiry, qidExpiry } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be approve or reject" });
    }

    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const updateData = {};

    if (action === "approve") {
      updateData.documentsStatus          = "approved";
      updateData.documentsRejectionReason = null;
      updateData.tradeLicenseStatus       = "approved";
      updateData.qidStatus                = "approved";

      if (tradeLicenseExpiry) updateData.tradeLicenseExpiry = new Date(tradeLicenseExpiry);
      if (qidExpiry)          updateData.qidExpiry          = new Date(qidExpiry);

      await sendCompanyDocumentEmail({
        toEmail:   company.email,
        brandName: company.brandName,
        action:    "approved",
      });
    } else {
      updateData.documentsStatus          = "rejected";
      updateData.documentsRejectionReason = reason || "Documents not valid";
      updateData.tradeLicenseStatus       = "rejected";
      updateData.qidStatus                = "rejected";

      await sendCompanyDocumentEmail({
        toEmail:   company.email,
        brandName: company.brandName,
        action:    "rejected",
        reason,
      });
    }

    const updated = await Company.findByIdAndUpdate(
      company._id,
      updateData,
      { new: true }
    ).select("-password");

    res.json({
      success: true,
      message: `Documents ${action}d ✅`,
      data:    updated,
    });
  } catch (err) {
    console.error("approveDocuments error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Toggle Company Active
//  PATCH /api/company/admin/companies/:id/toggle-active
// ═══════════════════════════════════════════════════════
exports.toggleActive = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    company.isActive = !company.isActive;
    await company.save();

    res.json({
      success: true,
      message: `Company ${company.isActive ? "activated" : "deactivated"}`,
      data:    { isActive: company.isActive },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Delete Company
//  DELETE /api/company/admin/companies/:id
// ═══════════════════════════════════════════════════════
exports.deleteCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    res.json({ success: true, message: "Company deleted ✅" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};