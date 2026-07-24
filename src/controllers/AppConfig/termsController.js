const TermsAndConditions = require("../../models/AppConfig/TermsAndConditions");

// GET /api/app/terms — Public (React Native app)
// Returns the latest active T&C
exports.getTerms = async (req, res) => {
  try {
    const terms = await TermsAndConditions.findOne({ isActive: true })
      .select("content version updatedAt")
      .sort({ createdAt: -1 });
    if (!terms) return res.status(404).json({ success: false, message: "Terms not found" });
    res.json({ success: true, data: terms });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin/app/terms — Admin (all versions)
exports.getAllTermsAdmin = async (req, res) => {
  try {
    const terms = await TermsAndConditions.find().sort({ createdAt: -1 });
    res.json({ success: true, total: terms.length, data: terms });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/admin/app/terms — Admin
// Deactivates all old versions and creates a new active one
exports.addTerms = async (req, res) => {
  try {
    const { content, version } = req.body;
    if (!content || !version) {
      return res.status(400).json({ success: false, message: "content and version are required" });
    }
    // Deactivate all previous versions
    await TermsAndConditions.updateMany({}, { isActive: false });
    const terms = await TermsAndConditions.create({ content, version, isActive: true });
    res.status(201).json({ success: true, data: terms });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/admin/app/terms/:id — Admin (edit existing version)
exports.updateTerms = async (req, res) => {
  try {
    const terms = await TermsAndConditions.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!terms) return res.status(404).json({ success: false, message: "Terms not found" });
    res.json({ success: true, data: terms });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
