const Country = require("../models/Country");

// GET /api/countries — Public
exports.getCountries = async (req, res) => {
  try {
    const countries = await Country.find({ isActive: true })
      .select("name code")
      .sort({ name: 1 });
    res.json({ success: true, total: countries.length, data: countries });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/countries — Admin
exports.addCountry = async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "name is required" });

    const country = await Country.create({ name, code });
    res.status(201).json({ success: true, data: country });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: "Country already exists" });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/countries/:id — Admin
exports.updateCountry = async (req, res) => {
  try {
    const { name, code } = req.body;
    const country = await Country.findByIdAndUpdate(
      req.params.id,
      { name, code },
      { new: true, runValidators: true }
    );
    if (!country) return res.status(404).json({ success: false, message: "Country not found" });
    res.json({ success: true, data: country });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/countries/:id/toggle — Admin
exports.toggleCountry = async (req, res) => {
  try {
    const country = await Country.findById(req.params.id);
    if (!country) return res.status(404).json({ success: false, message: "Country not found" });
    country.isActive = !country.isActive;
    await country.save();
    res.json({ success: true, message: `Country ${country.isActive ? "activated" : "deactivated"}`, data: { isActive: country.isActive } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE /api/countries/:id — Admin
exports.deleteCountry = async (req, res) => {
  try {
    const country = await Country.findByIdAndDelete(req.params.id);
    if (!country) return res.status(404).json({ success: false, message: "Country not found" });
    res.json({ success: true, message: "Country deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
