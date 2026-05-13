const jwt   = require("jsonwebtoken");
const Admin = require("../models/admin/admin");

// ─── Basic Auth ───────────────────────────────
const protectAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const admin = await Admin.findById(decoded.id).select("-password");
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: "Admin not found" });
    }

    req.admin = admin;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// ─── SuperAdmin Only ──────────────────────────
const superAdminOnly = (req, res, next) => {
  if (req.admin.role !== "superadmin") {
    return res.status(403).json({ 
      success: false, 
      message: "SuperAdmin access required" 
    });
  }
  next();
};

// ─── Admin + SuperAdmin (no user) ─────────────
const adminOnly = (req, res, next) => {
  if (req.admin.role === "user") {
    return res.status(403).json({ 
      success: false, 
      message: "Admin access required — read only mode" 
    });
  }
  next();
};

module.exports = { protectAdmin, superAdminOnly, adminOnly };