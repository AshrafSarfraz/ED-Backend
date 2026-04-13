const Company = require("../models/createCompany");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const generateTempPassword = require("../utils/generatePassword");
const { sendForgotPasswordEmail } = require("../utils/sendEmail");
const { uploadToFirebase } = require("../config/uploadToFirebase");


// ─── Get All Companies (Admin) ────────────────────────────
exports.getAllCompanies = async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const skip = (page - 1) * limit;
    const total = await Company.countDocuments(filter);
    const companies = await Company.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: companies,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// ─── Delete Company (Admin) ───────────────────────────────
exports.deleteCompany = async (req, res) => {
    try {
      const company = await Company.findByIdAndDelete(req.params.id);
      if (!company) {
        return res.status(404).json({ success: false, message: "Company not found" });
      }
      res.json({ success: true, message: "Company deleted successfully" });
    } catch (err) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
  

// ─── Login ───────────────────────────────────────────────
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
        return res.status(403).json({ success: false, message: "Account is deactivated" });
      }
  
      const isMatch = await bcrypt.compare(password, company.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
      }
  
      const token = jwt.sign({ id: company._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });
  
      res.json({
        success: true,
        token,
        data: {
          _id: company._id,
          brandName: company.brandName,
          email: company.email,
          isPasswordChanged: company.isPasswordChanged,
          companyLogo: company.companyLogo,
        },
      });
    } catch (err) {
      console.error("login error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
// ─── Get Single Company ───────────────────────────────────
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

// ─── Get My Profile (Logged in company) ──────────────────
exports.getMyProfile = async (req, res) => {
  try {
    const company = await Company.findById(req.company._id).select("-password");
    res.json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Update Profile (Company Admin) ──────────────────────
// Cannot change: brandName, email, tradeLicenseNumber
// ─── Update Profile (Company Admin) ──────────────────────
exports.updateMyProfile = async (req, res) => {
  try {
    const restricted = ["brandName", "email", "tradeLicenseNumber", "password"];
    restricted.forEach((field) => delete req.body[field]);

    const updatedData = { ...req.body };

    // ✅ Company ka joinAs dekho — Supplier ya Buyer
    const company = await Company.findById(req.company._id);
    const accountType = company.accountType?.toLowerCase() || "general"; // "supplier" ya "buyer"

    // ✅ Firebase upload — folder mein AccountType se divide
    if (req.files?.companyLogo) {
      const file = req.files.companyLogo[0];
      updatedData.companyLogo = await uploadToFirebase(
        file.buffer,
        file.originalname,
        `company-logos/${accountType}` // company-logos/supplier ya company-logos/buyer
      );
    }

    if (req.files?.tradeLicenseImage) {
      const file = req.files.tradeLicenseImage[0];
      updatedData.tradeLicenseImage = await uploadToFirebase(
        file.buffer,
        file.originalname,
        `trade-licenses/${accountType}` // trade-licenses/supplier ya trade-licenses/buyer
      );
    }

    if (req.files?.idImage) {
      const file = req.files.idImage[0];
      updatedData.idImage = await uploadToFirebase(
        file.buffer,
        file.originalname,
        `id-images/${accountType}` // id-images/supplier ya id-images/buyer
      );
    }

    // ✅ Profile complete check
    const willHaveLogo = updatedData.companyLogo || company.companyLogo;
    const willHaveLicense = updatedData.tradeLicenseImage || company.tradeLicenseImage;
    const willHaveId = updatedData.idImage || company.idImage;

    if (willHaveLogo && willHaveLicense && willHaveId) {
      updatedData.isProfileComplete = true;
    }

    const updated = await Company.findByIdAndUpdate(
      req.company._id,
      updatedData,
      { new: true, runValidators: true }
    ).select("-password");

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("updateMyProfile error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// ─── Change Password (Logged in company) ─────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Both fields required" });
    }

    const company = await Company.findById(req.company._id);
    const isMatch = await bcrypt.compare(currentPassword, company.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    company.password = await bcrypt.hash(newPassword, 10);
    company.isPasswordChanged = true;
    await company.save();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    console.error("changePassword error:", err); // yeh add karo
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Forgot Password ──────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    const company = await Company.findOne({ email });
    if (!company) {
      return res.status(404).json({ success: false, message: "No account found with this email" });
    }

    const newTempPassword = generateTempPassword();
    company.password = await bcrypt.hash(newTempPassword, 10);
    company.isPasswordChanged = false;
    await company.save();

    await sendForgotPasswordEmail({
      toEmail: company.email,
      brandName: company.brandName,
      tempPassword: newTempPassword,
    });

    res.json({ success: true, message: "New password sent to your email" });
  } catch (err) {
    console.error("forgotPassword error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// ─── Toggle Active Status (Admin) ────────────────────────
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
      data: { isActive: company.isActive },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};