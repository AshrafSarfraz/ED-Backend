const jwt          = require("jsonwebtoken");
const RiderCompany = require("../models/rider/riderCompany");

exports.protectRiderCompany = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "No token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const company = await RiderCompany.findById(decoded.id);

    if (!company || !company.isActive) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.riderCompany = company;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};