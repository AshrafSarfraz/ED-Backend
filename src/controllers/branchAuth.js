const jwt = require("jsonwebtoken");
const Branch = require("../models/Branch");

const branchAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== "branch") {
      return res.status(401).json({ success: false, message: "Invalid token type" });
    }

    const branch = await Branch.findById(decoded.id).select("-password");
    if (!branch) {
      return res.status(401).json({ success: false, message: "Branch not found" });
    }

    if (branch.status !== "approved") {
      return res.status(403).json({ success: false, message: "Branch not approved yet" });
    }

    if (!branch.isActive) {
      return res.status(403).json({ success: false, message: "Branch is deactivated" });
    }

    req.branch = branch;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

module.exports = branchAuth;