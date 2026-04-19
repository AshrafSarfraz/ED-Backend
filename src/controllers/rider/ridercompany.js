const RiderCompany  = require("../../models/rider/riderCompany");
const Rider         = require("../../models/rider/rider");
const DeliveryOrder = require("../../models/rider/deliveryOrder");
const bcrypt        = require("bcrypt");
const jwt           = require("jsonwebtoken");

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const company = await RiderCompany.findOne({ email });
    if (!company || !company.isActive) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const isMatch = await bcrypt.compare(password, company.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: company._id, type: "riderCompany" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      data: { _id: company._id, name: company.name, email: company.email },
    });
  } catch (err) {
    console.error("riderCompany login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Add Rider
exports.addRider = async (req, res) => {
  try {
    const { name, email, phone, vehicleType, vehicleNumber } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({ success: false, message: "name, email, phone required" });
    }

    const tempPassword = Math.random().toString(36).slice(-8);
    const hashed       = await bcrypt.hash(tempPassword, 10);

    const rider = await Rider.create({
      riderCompanyId: req.riderCompany._id,
      name,
      email,
      phone,
      password:      hashed,
      vehicleType:   vehicleType   || "bike",
      vehicleNumber: vehicleNumber || null,
    });

    res.status(201).json({
      success: true,
      message: "Rider added successfully",
      data: {
        _id:          rider._id,
        name:         rider.name,
        email:        rider.email,
        tempPassword,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }
    console.error("addRider error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get My Riders
exports.getMyRiders = async (req, res) => {
  try {
    const riders = await Rider.find({ riderCompanyId: req.riderCompany._id })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({ success: true, total: riders.length, data: riders });
  } catch (err) {
    console.error("getMyRiders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Dashboard
exports.getDashboard = async (req, res) => {
  try {
    const totalRiders   = await Rider.countDocuments({ riderCompanyId: req.riderCompany._id });
    const onlineRiders  = await Rider.countDocuments({ riderCompanyId: req.riderCompany._id, status: "online" });
    const busyRiders    = await Rider.countDocuments({ riderCompanyId: req.riderCompany._id, status: "busy" });
    const totalDeliveries     = await DeliveryOrder.countDocuments({ riderCompanyId: req.riderCompany._id });
    const completedDeliveries = await DeliveryOrder.countDocuments({ riderCompanyId: req.riderCompany._id, status: "completed" });
    const activeDeliveries    = await DeliveryOrder.countDocuments({ riderCompanyId: req.riderCompany._id, status: { $in: ["assigned", "picked_up", "at_warehouse"] } });

    const riders = await Rider.find({ riderCompanyId: req.riderCompany._id }).select("-password");
    const riderStats = await Promise.all(
      riders.map(async (rider) => {
        const orders       = await DeliveryOrder.find({ riderId: rider._id });
        const totalDelivered = orders.reduce((sum, d) => {
          return sum + d.deliveries.filter((dl) => dl.status === "delivered").length;
        }, 0);

        return {
          riderId:        rider._id,
          name:           rider.name,
          phone:          rider.phone,
          status:         rider.status,
          vehicleType:    rider.vehicleType,
          totalOrders:    orders.length,
          totalDelivered,
        };
      })
    );

    res.json({
      success: true,
      data: {
        totalRiders,
        onlineRiders,
        busyRiders,
        totalDeliveries,
        completedDeliveries,
        activeDeliveries,
        riders: riderStats,
      },
    });
  } catch (err) {
    console.error("getDashboard error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};