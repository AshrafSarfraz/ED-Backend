const Branch = require("../models/Branch");
const Company = require("../models/createCompany");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const generateTempPassword = require("../utils/generatePassword");
const { uploadToFirebase } = require("../config/uploadToFirebase");
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
    const { managerName, phone, email, password, branchNo } = req.body;

    if (!managerName || !phone || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "managerName, phone, email, and password are required",
      });
    }

    const exists = await Branch.findOne({ email });
    if (exists) {
      return res.status(409).json({ success: false, message: "A branch with this email already exists" });
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
      branchNo,
      phone,
      email,
      password:         hashedPassword,
      tempPassword:     password,
      registrationStep: 1,
      status:           "pending",
    });

    await sendBranchCredentialsEmail({
      toEmail:      branch.email,
      managerName:  branch.managerName,
      companyName:  branch.companyName,
      tempPassword: password,
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
//  BUYER    → address only
//  SUPPLIER → address + warehouseAddress + bankDetails
// ═══════════════════════════════════════════════════════════
exports.completeProfile = async (req, res) => {
  try {
    const { address, bankDetails, warehouseAddress } = req.body;
    const accountType = req.branch.accountType;

    if (!address || !address.address || !address.city) {
      return res.status(400).json({ success: false, message: "Address and City are required" });
    }

    const updateData = { address, registrationStep: 2 };

    if (accountType === "Supplier") {
      if (!warehouseAddress || !warehouseAddress.address) {
        return res.status(400).json({ success: false, message: "Warehouse address is required for Supplier" });
      }
      if (!bankDetails?.accountName || !bankDetails?.accountNumber || !bankDetails?.iban || !bankDetails?.bankName) {
        return res.status(400).json({ success: false, message: "Bank details are required for Supplier" });
      }
      updateData.warehouseAddress = warehouseAddress;
      updateData.bankDetails      = bankDetails;
    }

    const branch = await Branch.findByIdAndUpdate(req.branch._id, updateData, { new: true, runValidators: true }).select("-password");

    res.json({
      success: true,
      message: accountType === "Supplier" ? "Profile complete. Add catalog items." : "Profile complete. Awaiting admin approval.",
      data: branch,
    });
  } catch (err) {
    console.error("completeProfile error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateBranchProfile = async (req, res) => {
  try {
    const { phone, address, warehouseAddress, bankDetails } = req.body;

    const updateData = {};
    if (phone)            updateData.phone            = phone;
    if (address)          updateData.address          = address;
    if (warehouseAddress) updateData.warehouseAddress = warehouseAddress;
    if (bankDetails)      updateData.bankDetails      = bankDetails;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    const branch = await Branch.findByIdAndUpdate(req.branch._id, updateData, {
      new: true,
      runValidators: true,
    })
      .select("-password")
      .populate("companyId", "brandName email accountType companyLogo tradeLicenseNumber tradeLicenseImage tradeLicenseExpiry");

    res.json({ success: true, message: "Profile updated successfully", data: branch });
  } catch (err) {
    console.error("updateBranchProfile error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// ═══════════════════════════════════════════════════════════
//  ADMIN — Upload Contract PDF  (Buyer + Supplier)
//  POST /api/branch/admin/branches/:id/upload-contract
//  Auth: Admin token  |  multipart field: "contract"
// ═══════════════════════════════════════════════════════════
exports.uploadContract = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

    if (!req.file) return res.status(400).json({ success: false, message: "Contract PDF file is required" });

    // Upload new file — old URL stays in Firebase, DB gets updated with new URL
    const url = await uploadToFirebase(req.file.buffer, req.file.originalname, `contracts/${branch._id}`);
    await Branch.findByIdAndUpdate(branch._id, { contractPdf: url });

    res.json({ success: true, message: "Contract uploaded successfully", data: { contractPdf: url } });
  } catch (err) {
    console.error("uploadContract error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  ADMIN — Upload PDC Image + Set PDC Amount  (Buyer only)
//  POST /api/branch/admin/branches/:id/upload-pdc
//  Auth: Admin token  |  multipart field: "pdcImage"
//  Body: { pdcAmount: Number }
// ═══════════════════════════════════════════════════════════
exports.uploadPdc = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

    if (branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "PDC is only for Buyer branches" });
    }

    const { pdcAmount } = req.body;
    if (!pdcAmount || isNaN(pdcAmount)) {
      return res.status(400).json({ success: false, message: "pdcAmount (number) is required" });
    }

    let pdcImageUrl = branch.pdcImage; // keep existing if no new file

    if (req.file) {
      // Upload new image — old image stays in Firebase, DB gets updated
      pdcImageUrl = await uploadToFirebase(req.file.buffer, req.file.originalname, `pdc/${branch._id}`);
    }

    await Branch.findByIdAndUpdate(branch._id, { pdcImage: pdcImageUrl, pdcAmount: Number(pdcAmount) });

    res.json({
      success: true,
      message: "PDC details saved successfully",
      data: { pdcImage: pdcImageUrl, pdcAmount: Number(pdcAmount) },
    });
  } catch (err) {
    console.error("uploadPdc error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

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
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

    if (action === "approve") {
      branch.status          = "approved";
      branch.rejectionReason = null;
      await branch.save();
      await sendBranchApprovalEmail({ toEmail: branch.email, managerName: branch.managerName, companyName: branch.companyName });
    } else {
      branch.status          = "rejected";
      branch.rejectionReason = reason;
      await branch.save();
      await sendBranchRejectionEmail({ toEmail: branch.email, managerName: branch.managerName, companyName: branch.companyName, reason });
    }

    res.json({
      success: true,
      message: `Branch ${branch.status} successfully. Email sent.`,
      data: { _id: branch._id, status: branch.status, rejectionReason: branch.rejectionReason },
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
    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required" });

    const branch = await Branch.findOne({ email })
      .populate("companyId", "brandName email accountType companyLogo tradeLicenseNumber tradeLicenseImage tradeLicenseExpiry");
    if (!branch) return res.status(401).json({ success: false, message: "Invalid credentials" });

    if (branch.status !== "approved") {
      return res.status(403).json({
        success: false,
        message: branch.status === "pending" ? "Your branch is pending admin approval" : "Your branch has been rejected. Contact your company admin.",
      });
    }
    if (!branch.isActive) return res.status(403).json({ success: false, message: "This branch account has been deactivated" });

    const isMatch = await bcrypt.compare(password, branch.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign({ id: branch._id, type: "branch" }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      token,
      data: {
        _id:               branch._id,
        companyName:       branch.companyName,
        accountType:       branch.accountType,
        managerName:       branch.managerName,
        phone:             branch.phone,
        branchNo:          branch.branchNo,
        email:             branch.email,
        address:           branch.address,
        warehouseAddress:  branch.warehouseAddress,
        bankDetails:       branch.bankDetails,
        pdcImage:          branch.pdcImage,
        pdcAmount:         branch.pdcAmount,
        contractPdf:       branch.contractPdf, 
        branchLogo:        branch.branchLogo,
        status:            branch.status,
        registrationStep:  branch.registrationStep,
        isPasswordChanged: branch.isPasswordChanged,
        company: {
          logo:               branch.companyId?.companyLogo || null,
          tradeLicenseImage:  branch.companyId?.tradeLicenseImage || null,
          tradeLicenseExpiry: branch.companyId?.tradeLicenseExpiry || null,
        },
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
// ═══════════════════════════════════════════════════════════
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const branch = await Branch.findOne({ email });
    if (!branch) return res.status(404).json({ success: false, message: "No branch found with this email" });

    const tempPassword       = generateTempPassword();
    branch.password          = await bcrypt.hash(tempPassword, 10);
    branch.isPasswordChanged = false;
    await branch.save();

    await sendBranchForgotPasswordEmail({ toEmail: branch.email, managerName: branch.managerName, tempPassword });

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
      .populate("companyId", "brandName email accountType companyLogo tradeLicenseNumber tradeLicenseImage tradeLicenseExpiry");
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
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: "Both fields are required" });

    const branch  = await Branch.findById(req.branch._id);
    const isMatch = await bcrypt.compare(currentPassword, branch.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Current password is incorrect" });

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
    const branches = await Branch.find({ companyId: req.company._id }).select("-password").sort({ createdAt: -1 });
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
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found or does not belong to your company" });
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
    res.json({ success: true, message: `Branch ${branch.isActive ? "activated" : "deactivated"}`, data: { isActive: branch.isActive } });
  } catch (err) {
    console.error("toggleBranchActive error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  COMPANY — Get All Branch Items (Supplier catalog)
// ═══════════════════════════════════════════════════════════
exports.getCompanyBranchItems = async (req, res) => {
  try {
    const SupplierItem = require("../models/supplier/supplierCatalog");
    const items = await SupplierItem.find({ companyId: req.company._id })
      .populate("platformItemId", "name image unit")
      .populate("categoryId",     "name")
      .populate("countryId",      "name code")
      .populate("branchId",       "managerName branchNo email")
      .sort({ createdAt: -1 });
    res.json({ success: true, total: items.length, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  ADMIN/COMPANY — Get Branch Detail + Catalog Items
//  GET /api/branch/admin/branches/:branchId/detail
// ═══════════════════════════════════════════════════════════
exports.getBranchDetail = async (req, res) => {
  try {
    const SupplierItem = require("../models/supplier/supplierCatalog");

    const branch = await Branch.findById(req.params.branchId)
      .select("-password")
      .populate("companyId", "brandName email accountType");

    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

    if (req.company && branch.companyId._id.toString() !== req.company._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    let items = [];
    if (branch.accountType === "Supplier") {
      items = await SupplierItem.find({ branchId: branch._id })
        .populate("platformItemId", "name image unit")
        .populate("categoryId",     "name")
        .populate("countryId",      "name code")
        .sort({ createdAt: -1 });
    }

    res.json({ success: true, data: { branch, totalItems: items.length, items } });
  } catch (err) {
    console.error("getBranchDetail error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};