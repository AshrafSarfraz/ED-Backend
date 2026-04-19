const jwt   = require("jsonwebtoken");
const Rider = require("../models/rider/rider"); // ← Rider model

exports.protectRider = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "No token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const rider   = await Rider.findById(decoded.id);

    if (!rider || !rider.isActive) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.rider = rider;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};