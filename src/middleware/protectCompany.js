const jwt = require("jsonwebtoken");
const Company = require("../models/createCompany");

exports.protectCompany = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const company = await Company.findById(decoded.id).select("-password");
    if (!company) {
      return res.status(401).json({ success: false, message: "Company not found" });
    }

    if (!company.isActive) {
      return res.status(403).json({ success: false, message: "Account is deactivated" });
    }

    req.company = company;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};