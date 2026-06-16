// 📁 middleware/protectDelivery.js
// Delivery company ka token check — req.deliveryCompany set karta hai
const jwt = require("jsonwebtoken");
const DeliveryCompany = require("../models/riderCompany/riderCompany");

exports.protectDelivery = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "delivery") {
      return res.status(403).json({ success: false, message: "Not a delivery account" });
    }

    const company = await DeliveryCompany.findById(decoded.id).select("-password");
    if (!company || !company.isActive) {
      return res.status(401).json({ success: false, message: "Account not found or inactive" });
    }

    req.deliveryCompany = company;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Not authorized, token failed" });
  }
};