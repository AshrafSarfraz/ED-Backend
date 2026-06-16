// 📁 controllers/delivery/auth.js
// Delivery company login — JWT token deta hai
const jwt = require("jsonwebtoken");
const DeliveryCompany = require("../../models/riderCompany/riderCompany");

const genToken = (id) =>
  jwt.sign({ id, role: "delivery" }, process.env.JWT_SECRET, { expiresIn: "30d" });

// ─── Login ───
// POST /api/delivery/auth/login   { email, password }
exports.deliveryLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const company = await DeliveryCompany.findOne({ email: email.toLowerCase() });
    if (!company || !company.isActive) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const ok = await company.matchPassword(password);
    if (!ok) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    res.json({
      success: true,
      message: "Login successful",
      token: genToken(company._id),
      data: {
        _id:   company._id,
        name:  company.name,
        email: company.email,
        phone: company.phone,
      },
    });
  } catch (err) {
    console.error("deliveryLogin error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Admin: delivery company banao (ek baar) ───
// POST /api/delivery/auth/register   { name, email, password, phone }
exports.createDeliveryCompany = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "name, email, password required" });
    }

    const exists = await DeliveryCompany.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const company = await DeliveryCompany.create({ name, email, password, phone });

    res.status(201).json({
      success: true,
      message: "Delivery company created",
      data: { _id: company._id, name: company.name, email: company.email },
    });
  } catch (err) {
    console.error("createDeliveryCompany error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};