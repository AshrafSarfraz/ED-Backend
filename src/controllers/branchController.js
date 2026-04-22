const Branch = require("../models/Branch");
const Company = require("../models/createCompany");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const generateTempPassword = require("../utils/generatePassword");
const {
  sendBranchCredentialsEmail,
  sendBranchApprovalEmail,
  sendBranchRejectionEmail,
  sendBranchForgotPasswordEmail,
} = require("../utils/sendEmail");

// ═══════════════════════════════════════════════════════════
//  STEP 0.1 — Company adds a new Branch (basic info)
//  POST /api/company/my-branches/add
//  Auth: Company token
// ═══════════════════════════════════════════════════════════
exports.addBranch = async (req, res) => {
  try {
    const { managerName, phone, email, password } = req.body;

    if (!managerName || !phone || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "managerName, phone, email, and password are required",
      });
    }

    const exists = await Branch.findOne({ email });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "A branch with this email already exists",
      });
    }

    const company = await Company.findById(req.company._id);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const branch = await Branch.create({
      companyId:        company._id,
      companyName:      company.brandName,
      accountType:      company.accountType,
      managerName,
      phone,
      email,
      password:         hashedPassword,
      tempPassword:     password, // plain — email mein bhejne ke liye
      registrationStep: 1,
      status:           "pending",
    });

    // Branch bante hi password email kar do
    await sendBranchCredentialsEmail({
      toEmail:     branch.email,
      managerName: branch.managerName,
      companyName: branch.companyName,
      tempPassword: password, // plain password — jo company nay set kiya
    });

    res.status(201).json({
      success: true,
      message: "Branch created. Login credentials sent to branch email.",
      data: {
        _id:              branch._id,
        companyName:      branch.companyName,
        accountType:      branch.accountType,
        managerName:      branch.managerName,
        email:            branch.email,
        status:           branch.status,
        registrationStep: branch.registrationStep,
      },
    });
  } catch (err) {
    console.error("addBranch error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  STEP 0.2 — Branch completes profile (address + bank)
//  PUT /api/branch/profile/complete
//  Auth: Branch token
// ═══════════════════════════════════════════════════════════
exports.completeProfile = async (req, res) => {
  try {
    const { address, bankDetails, warehouseAddress } = req.body;

    if (!address) {
      return res.status(400).json({ success: false, message: "Address is required" });
    }

    if (!bankDetails?.accountName || !bankDetails?.accountNumber || 
        !bankDetails?.iban || !bankDetails?.bankName) {
      return res.status(400).json({
        success: false,
        message: "Complete bank details are required",
      });
    }

    const updateData = {
      address,      // ← object: { lat, lng, address, area, city }
      bankDetails,
      registrationStep: 2,
    };

    // Supplier ke liye warehouseAddress
    if (req.branch.accountType === "Supplier" && warehouseAddress) {
      updateData.warehouseAddress = warehouseAddress;
    }

    const branch = await Branch.findByIdAndUpdate(
      req.branch._id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    res.json({
      success: true,
      message: branch.accountType === "Supplier"
        ? "Profile updated. Now add your catalog items."
        : "Profile complete. Awaiting admin approval.",
      data: branch,
    });
  } catch (err) {
    console.error("completeProfile error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  STEP 0.3 — Supplier: mark catalog as added
//  PUT /api/branch/catalog/mark-complete
//  Auth: Branch token (Supplier only)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
//  ADMIN — Approve or Reject Branch + Email
//  PUT /api/branch/admin/branches/:id/approve
// ═══════════════════════════════════════════════════════════
exports.approveBranch = async (req, res) => {
  try {
    const { action, reason } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be 'approve' or 'reject'" });
    }

    if (action === "reject" && !reason) {
      return res.status(400).json({ success: false, message: "Rejection reason is required" });
    }

    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    if (action === "approve") {
      branch.status          = "approved";
      branch.rejectionReason = null;
      await branch.save();

      // Sirf approval notification — password email pehle ja chuka hai
      await sendBranchApprovalEmail({
        toEmail:     branch.email,
        managerName: branch.managerName,
        companyName: branch.companyName,
      });

    } else {
      branch.status          = "rejected";
      branch.rejectionReason = reason;
      await branch.save();

      await sendBranchRejectionEmail({
        toEmail:     branch.email,
        managerName: branch.managerName,
        companyName: branch.companyName,
        reason,
      });
    }

    res.json({
      success: true,
      message: `Branch ${branch.status} successfully. Email sent.`,
      data: {
        _id:             branch._id,
        status:          branch.status,
        rejectionReason: branch.rejectionReason,
      },
    });
  } catch (err) {
    console.error("approveBranch error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  BRANCH LOGIN
//  POST /api/branch/auth/login
// ═══════════════════════════════════════════════════════════
exports.branchLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const branch = await Branch.findOne({ email });
    if (!branch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (branch.status !== "approved") {
      return res.status(403).json({
        success: false,
        message: branch.status === "pending"
          ? "Your branch is pending admin approval"
          : "Your branch has been rejected. Contact your company admin.",
      });
    }

    if (!branch.isActive) {
      return res.status(403).json({ success: false, message: "This branch account has been deactivated" });
    }

    const isMatch = await bcrypt.compare(password, branch.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: branch._id, type: "branch" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      data: {
        _id:               branch._id,
        companyId:         branch.companyId,
        companyName:       branch.companyName,
        accountType:       branch.accountType,
        managerName:       branch.managerName,
        email:             branch.email,
        registrationStep:  branch.registrationStep,
        isPasswordChanged: branch.isPasswordChanged,
      },
    });
  } catch (err) {
    console.error("branchLogin error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  BRANCH — Forgot Password
//  POST /api/branch/auth/forgot-password
//  Public
// ═══════════════════════════════════════════════════════════
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const branch = await Branch.findOne({ email });
    if (!branch) {
      return res.status(404).json({ success: false, message: "No branch found with this email" });
    }

    const tempPassword   = generateTempPassword();
    branch.password      = await bcrypt.hash(tempPassword, 10);
    branch.isPasswordChanged = false;
    await branch.save();

    await sendBranchForgotPasswordEmail({
      toEmail:     branch.email,
      managerName: branch.managerName,
      tempPassword,
    });

    res.json({ success: true, message: "New password sent to your email" });
  } catch (err) {
    console.error("forgotPassword error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  BRANCH — Get My Profile
//  GET /api/branch/auth/me
// ═══════════════════════════════════════════════════════════
exports.getMyProfile = async (req, res) => {
  try {
    const branch = await Branch.findById(req.branch._id)
      .select("-password")
      .populate("companyId", "brandName email accountType");
    res.json({ success: true, data: branch });
  } catch (err) {
    console.error("getMyProfile error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  BRANCH — Change Password
//  PUT /api/branch/auth/change-password
// ═══════════════════════════════════════════════════════════
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Both fields are required" });
    }

    const branch  = await Branch.findById(req.branch._id);
    const isMatch = await bcrypt.compare(currentPassword, branch.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    branch.password          = await bcrypt.hash(newPassword, 10);
    branch.isPasswordChanged = true;
    await branch.save();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    console.error("changePassword error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  COMPANY — Get All My Branches
//  GET /api/company/my-branches
// ═══════════════════════════════════════════════════════════
exports.getMyBranches = async (req, res) => {
  try {
    const branches = await Branch.find({ companyId: req.company._id })
      .select("-password")
      .sort({ createdAt: -1 });
    res.json({ success: true, total: branches.length, data: branches });
  } catch (err) {
    console.error("getMyBranches error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  COMPANY — Delete Own Branch
//  DELETE /api/company/my-branches/:id
// ═══════════════════════════════════════════════════════════
exports.companyDeleteBranch = async (req, res) => {
  try {
    const branch = await Branch.findOne({ _id: req.params.id, companyId: req.company._id });
    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found or does not belong to your company" });
    }
    await Branch.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Branch deleted successfully" });
  } catch (err) {
    console.error("companyDeleteBranch error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  ADMIN — Get All Branches
//  GET /api/branch/admin/branches
// ═══════════════════════════════════════════════════════════
exports.getAllBranches = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, accountType, companyId } = req.query;
    const filter = {};
    if (status)      filter.status      = status;
    if (accountType) filter.accountType = accountType;
    if (companyId)   filter.companyId   = companyId;

    const skip  = (page - 1) * limit;
    const total = await Branch.countDocuments(filter);

    const branches = await Branch.find(filter)
      .select("-password")
      .populate("companyId", "brandName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), data: branches });
  } catch (err) {
    console.error("getAllBranches error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  ADMIN — Delete Any Branch
//  DELETE /api/branch/admin/branches/:id
// ═══════════════════════════════════════════════════════════
exports.adminDeleteBranch = async (req, res) => {
  try {
    const branch = await Branch.findByIdAndDelete(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });
    res.json({ success: true, message: "Branch deleted successfully" });
  } catch (err) {
    console.error("adminDeleteBranch error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  ADMIN — Toggle Branch Active/Inactive
//  PUT /api/branch/admin/branches/:id/toggle
// ═══════════════════════════════════════════════════════════
exports.toggleBranchActive = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });
    branch.isActive = !branch.isActive;
    await branch.save();
    res.json({
      success: true,
      message: `Branch ${branch.isActive ? "activated" : "deactivated"}`,
      data: { isActive: branch.isActive },
    });
  } catch (err) {
    console.error("toggleBranchActive error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



// const Branch = require("../models/Branch");
// const Company = require("../models/createCompany");
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");

// // ═══════════════════════════════════════════════════════════
// //  STEP 0.1 — Company adds a new Branch (basic info)
// //  POST /api/company/branches/add
// //  Auth: Company token
// // ═══════════════════════════════════════════════════════════
// exports.addBranch = async (req, res) => {
//   try {
//     const { managerName, phone, email, password } = req.body;

//     // Validate required fields
//     if (!managerName || !phone || !email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: "managerName, phone, email, and password are required",
//       });
//     }

//     // Check email uniqueness
//     const exists = await Branch.findOne({ email });
//     if (exists) {
//       return res.status(409).json({
//         success: false,
//         message: "A branch with this email already exists",
//       });
//     }

//     // Get company info to auto-fill companyName and accountType
//     const company = await Company.findById(req.company._id);
//     if (!company) {
//       return res.status(404).json({ success: false, message: "Company not found" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const branch = await Branch.create({
//       companyId:   company._id,
//       companyName: company.brandName,
//       accountType: company.accountType, // auto-inherited from company
//       managerName,
//       phone,
//       email,
//       password: hashedPassword,
//       registrationStep: 1,
//       status: "pending",
//     });

//     res.status(201).json({
//       success: true,
//       message: "Branch created. Awaiting admin approval after completing profile.",
//       data: {
//         _id:              branch._id,
//         companyName:      branch.companyName,
//         accountType:      branch.accountType,
//         managerName:      branch.managerName,
//         email:            branch.email,
//         status:           branch.status,
//         registrationStep: branch.registrationStep,
//       },
//     });
//   } catch (err) {
//     console.error("addBranch error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════════
// //  STEP 0.2 — Branch completes profile (address + bank)
// //  PUT /api/branch/profile/complete
// //  Auth: Branch token
// // ═══════════════════════════════════════════════════════════
// exports.completeProfile = async (req, res) => {
//   try {
//     const { address, bankDetails } = req.body;

//     if (!address) {
//       return res.status(400).json({
//         success: false,
//         message: "Address is required",
//       });
//     }

//     if (
//       !bankDetails ||
//       !bankDetails.accountName ||
//       !bankDetails.accountNumber ||
//       !bankDetails.iban ||
//       !bankDetails.bankName
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Complete bank details are required (accountName, accountNumber, iban, bankName)",
//       });
//     }

//     const branch = await Branch.findByIdAndUpdate(
//       req.branch._id,
//       {
//         address,
//         bankDetails,
//         registrationStep: 2,
//       },
//       { new: true, runValidators: true }
//     ).select("-password");

//     res.json({
//       success: true,
//       message:
//         branch.accountType === "Supplier"
//           ? "Profile updated. Now add your catalog items to complete registration."
//           : "Profile complete. Awaiting admin approval.",
//       data: branch,
//     });
//   } catch (err) {
//     console.error("completeProfile error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════════
// //  STEP 0.3 — Supplier: mark catalog as added
// //  PUT /api/branch/catalog/mark-complete
// //  Auth: Branch token (Supplier only)
// //  Note: Actual item adding is handled in catalog controller
// //        This just updates registrationStep to 3
// // ═══════════════════════════════════════════════════════════
// exports.markCatalogComplete = async (req, res) => {
//   try {
//     const branch = await Branch.findById(req.branch._id);

//     if (branch.accountType !== "Supplier") {
//       return res.status(403).json({
//         success: false,
//         message: "Only supplier branches can add catalog",
//       });
//     }

//     if (branch.registrationStep < 2) {
//       return res.status(400).json({
//         success: false,
//         message: "Please complete your address and bank details first (Step 2)",
//       });
//     }

//     branch.registrationStep = 3;
//     await branch.save();

//     res.json({
//       success: true,
//       message: "Catalog marked as complete. Registration is now fully done.",
//       data: { registrationStep: branch.registrationStep },
//     });
//   } catch (err) {
//     console.error("markCatalogComplete error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════════
// //  ADMIN — Approve or Reject Branch
// //  PUT /api/admin/branches/:id/approve
// //  Auth: Admin token
// // ═══════════════════════════════════════════════════════════
// exports.approveBranch = async (req, res) => {
//   try {
//     const { action, reason } = req.body;

//     if (!["approve", "reject"].includes(action)) {
//       return res.status(400).json({
//         success: false,
//         message: "action must be 'approve' or 'reject'",
//       });
//     }

//     if (action === "reject" && !reason) {
//       return res.status(400).json({
//         success: false,
//         message: "Rejection reason is required",
//       });
//     }

//     const branch = await Branch.findById(req.params.id);
//     if (!branch) {
//       return res.status(404).json({ success: false, message: "Branch not found" });
//     }

//     branch.status          = action === "approve" ? "approved" : "rejected";
//     branch.rejectionReason = action === "reject" ? reason : null;
//     await branch.save();

//     res.json({
//       success: true,
//       message: `Branch ${branch.status} successfully`,
//       data: {
//         _id:             branch._id,
//         status:          branch.status,
//         rejectionReason: branch.rejectionReason,
//       },
//     });
//   } catch (err) {
//     console.error("approveBranch error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════════
// //  BRANCH LOGIN
// //  POST /api/branch/auth/login
// //  Public
// // ═══════════════════════════════════════════════════════════
// exports.branchLogin = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: "Email and password are required",
//       });
//     }

//     const branch = await Branch.findOne({ email });
//     if (!branch) {
//       return res.status(401).json({ success: false, message: "Invalid credentials" });
//     }

//     // Only approved branches can login
//     if (branch.status !== "approved") {
//       return res.status(403).json({
//         success: false,
//         message:
//           branch.status === "pending"
//             ? "Your branch is pending admin approval"
//             : "Your branch has been rejected. Contact your company admin.",
//       });
//     }

//     if (!branch.isActive) {
//       return res.status(403).json({
//         success: false,
//         message: "This branch account has been deactivated",
//       });
//     }

//     const isMatch = await bcrypt.compare(password, branch.password);
//     if (!isMatch) {
//       return res.status(401).json({ success: false, message: "Invalid credentials" });
//     }

//     const token = jwt.sign(
//       { id: branch._id, type: "branch" },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     res.json({
//       success: true,
//       token,
//       data: {
//         _id:              branch._id,
//         companyId:        branch.companyId,
//         companyName:      branch.companyName,
//         accountType:      branch.accountType,
//         managerName:      branch.managerName,
//         email:            branch.email,
//         registrationStep: branch.registrationStep,
//         isPasswordChanged: branch.isPasswordChanged,
//       },
//     });
//   } catch (err) {
//     console.error("branchLogin error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════════
// //  BRANCH — Get My Profile
// //  GET /api/branch/auth/me
// //  Auth: Branch token
// // ═══════════════════════════════════════════════════════════
// exports.getMyProfile = async (req, res) => {
//   try {
//     const branch = await Branch.findById(req.branch._id)
//       .select("-password")
//       .populate("companyId", "brandName email accountType");

//     res.json({ success: true, data: branch });
//   } catch (err) {
//     console.error("getMyProfile error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════════
// //  BRANCH — Change Password
// //  PUT /api/branch/auth/change-password
// //  Auth: Branch token
// // ═══════════════════════════════════════════════════════════
// exports.changePassword = async (req, res) => {
//   try {
//     const { currentPassword, newPassword } = req.body;

//     if (!currentPassword || !newPassword) {
//       return res.status(400).json({
//         success: false,
//         message: "Both currentPassword and newPassword are required",
//       });
//     }

//     const branch = await Branch.findById(req.branch._id);
//     const isMatch = await bcrypt.compare(currentPassword, branch.password);

//     if (!isMatch) {
//       return res.status(401).json({
//         success: false,
//         message: "Current password is incorrect",
//       });
//     }

//     branch.password          = await bcrypt.hash(newPassword, 10);
//     branch.isPasswordChanged = true;
//     await branch.save();

//     res.json({ success: true, message: "Password changed successfully" });
//   } catch (err) {
//     console.error("changePassword error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════════
// //  COMPANY — Get All My Branches
// //  GET /api/company/branches
// //  Auth: Company token
// // ═══════════════════════════════════════════════════════════
// exports.getMyBranches = async (req, res) => {
//   try {
//     const branches = await Branch.find({ companyId: req.company._id })
//       .select("-password")
//       .sort({ createdAt: -1 });

//     res.json({
//       success: true,
//       total: branches.length,
//       data: branches,
//     });
//   } catch (err) {
//     console.error("getMyBranches error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════════
// //  ADMIN — Get All Branches (with filters)
// //  GET /api/admin/branches
// //  Auth: Admin token
// // ═══════════════════════════════════════════════════════════
// exports.getAllBranches = async (req, res) => {
//   try {
//     const { page = 1, limit = 20, status, accountType, companyId } = req.query;
//     const filter = {};

//     if (status)      filter.status      = status;
//     if (accountType) filter.accountType = accountType;
//     if (companyId)   filter.companyId   = companyId;

//     const skip  = (page - 1) * limit;
//     const total = await Branch.countDocuments(filter);

//     const branches = await Branch.find(filter)
//       .select("-password")
//       .populate("companyId", "brandName email")
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(Number(limit));

//     res.json({
//       success: true,
//       total,
//       page:  Number(page),
//       pages: Math.ceil(total / limit),
//       data:  branches,
//     });
//   } catch (err) {
//     console.error("getAllBranches error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════════
// //  COMPANY — Delete Own Branch
// //  DELETE /api/branch/company/branches/:id
// //  Auth: Company token
// // ═══════════════════════════════════════════════════════════
// exports.companyDeleteBranch = async (req, res) => {
//   try {
//     // Sirf apni branch delete kar sakti hai company
//     const branch = await Branch.findOne({
//       _id:       req.params.id,
//       companyId: req.company._id,
//     });

//     if (!branch) {
//       return res.status(404).json({
//         success: false,
//         message: "Branch not found or does not belong to your company",
//       });
//     }

//     await Branch.findByIdAndDelete(req.params.id);

//     res.json({ success: true, message: "Branch deleted successfully" });
//   } catch (err) {
//     console.error("companyDeleteBranch error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════════
// //  ADMIN — Delete Any Branch
// //  DELETE /api/branch/admin/branches/:id
// //  Auth: Admin token
// // ═══════════════════════════════════════════════════════════
// exports.adminDeleteBranch = async (req, res) => {
//   try {
//     const branch = await Branch.findByIdAndDelete(req.params.id);

//     if (!branch) {
//       return res.status(404).json({ success: false, message: "Branch not found" });
//     }

//     res.json({ success: true, message: "Branch deleted successfully" });
//   } catch (err) {
//     console.error("adminDeleteBranch error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════════
// //  ADMIN — Toggle Branch Active/Inactive
// //  PUT /api/branch/admin/branches/:id/toggle
// //  Auth: Admin token
// // ═══════════════════════════════════════════════════════════
// exports.toggleBranchActive = async (req, res) => {
//   try {
//     const branch = await Branch.findById(req.params.id);

//     if (!branch) {
//       return res.status(404).json({ success: false, message: "Branch not found" });
//     }

//     branch.isActive = !branch.isActive;
//     await branch.save();

//     res.json({
//       success: true,
//       message: `Branch ${branch.isActive ? "activated" : "deactivated"}`,
//       data: { isActive: branch.isActive },
//     });
//   } catch (err) {
//     console.error("toggleBranchActive error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };