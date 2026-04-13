const jwt = require("jsonwebtoken");
const Branch = require("../models/branch");

exports.protectBranch = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const branch = await Branch.findById(decoded.id).select("-password");

    if (!branch) {
      return res.status(401).json({
        success: false,
        message: "Branch not found",
      });
    }

    if (!branch.isActive) {
      return res.status(403).json({
        success: false,
        message: "Branch is deactivated",
      });
    }

    req.branch = branch;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};