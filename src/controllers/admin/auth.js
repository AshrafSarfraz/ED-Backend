const Admin  = require("../../models/admin/admin");
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const crypto = require("crypto");
const { sendAdminCredentialsEmail } = require("../../utils/sendEmail");

// ═══════════════════════════════════════════════════════
//  Setup — Pehla SuperAdmin banao
//  POST /api/admin/auth/setup  (public — sirf ek baar)
// ═══════════════════════════════════════════════════════
exports.setup = async (req, res) => {
  try {
    const existing = await Admin.findOne({ role: "superadmin" });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "SuperAdmin already exists",
      });
    }

    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "name, email, password required",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await Admin.create({
      name,
      email,
      password: hashedPassword,
      role:     "superadmin",
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "SuperAdmin created ✅",
      data: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    console.error("setup error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  Create Admin/User (SuperAdmin only)
//  POST /api/admin/auth/create
// ═══════════════════════════════════════════════════════
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: "name and email required" });
    }

    if (role === "superadmin") {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot create another SuperAdmin" 
      });
    }

    const exists = await Admin.findOne({ email });
    if (exists) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    // Random password generate karo
    const tempPassword   = crypto.randomBytes(6).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const admin = await Admin.create({
      name,
      email,
      password: hashedPassword,
      role:     role || "admin",
      isActive: true,
    });

    // Email bhejo
    await sendAdminCredentialsEmail({
      toEmail:  admin.email,
      name:     admin.name,
      password: tempPassword,
      role:     admin.role,
    });

    res.status(201).json({
      success: true,
      message: `${admin.role} created. Credentials sent to email ✅`,
      data: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    console.error("createAdmin error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  Login
//  POST /api/admin/auth/login
// ═══════════════════════════════════════════════════════
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: "Account deactivated" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin._id, type: "admin", role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      data: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  Get My Profile
//  GET /api/admin/auth/me
// ═══════════════════════════════════════════════════════
exports.getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select("-password");
    res.json({ success: true, data: admin });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  Change Password
//  PUT /api/admin/auth/change-password
// ═══════════════════════════════════════════════════════
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Both fields required" });
    }

    const admin   = await Admin.findById(req.admin._id);
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password incorrect" });
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();

    res.json({ success: true, message: "Password changed ✅" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  Forgot Password
//  POST /api/admin/auth/forgot-password
// ═══════════════════════════════════════════════════════
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ success: false, message: "No admin found with this email" });
    }

    const newPassword  = crypto.randomBytes(6).toString("hex");
    admin.password     = await bcrypt.hash(newPassword, 10);
    await admin.save();

    await sendAdminCredentialsEmail({
      toEmail:  admin.email,
      name:     admin.name,
      password: newPassword,
      role:     admin.role,
    });

    res.json({ success: true, message: "New password sent to email ✅" });
  } catch (err) {
    console.error("forgotPassword error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  Get All Admins
//  GET /api/admin/auth/all
// ═══════════════════════════════════════════════════════
exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find().select("-password").sort({ createdAt: -1 });
    res.json({ success: true, total: admins.length, data: admins });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  Update Admin (SuperAdmin only)
//  PUT /api/admin/auth/:id
// ═══════════════════════════════════════════════════════
exports.updateAdmin = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    // SuperAdmin ko update nahi kar sakte
    if (admin.role === "superadmin" && req.admin.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Cannot update SuperAdmin" });
    }

    // Role ko superadmin nahi kar sakte
    if (req.body.role === "superadmin") {
      return res.status(400).json({ success: false, message: "Cannot assign superadmin role" });
    }

    const { name, role } = req.body;
    if (name) admin.name = name;
    if (role) admin.role = role;
    await admin.save();

    res.json({ success: true, message: "Admin updated ✅", data: admin });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  Delete Admin (SuperAdmin only)
//  DELETE /api/admin/auth/:id
// ═══════════════════════════════════════════════════════
exports.deleteAdmin = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    // SuperAdmin ko delete nahi kar sakte
    if (admin.role === "superadmin") {
      return res.status(403).json({ 
        success: false, 
        message: "SuperAdmin cannot be deleted" 
      });
    }

    await Admin.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Admin deleted ✅" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  Toggle Active (SuperAdmin only)
//  PUT /api/admin/auth/:id/toggle
// ═══════════════════════════════════════════════════════
exports.toggleAdmin = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    if (admin.role === "superadmin") {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot deactivate SuperAdmin" 
      });
    }

    admin.isActive = !admin.isActive;
    await admin.save();

    res.json({
      success: true,
      message: `Admin ${admin.isActive ? "activated" : "deactivated"} ✅`,
      data: { isActive: admin.isActive },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};