const Faq = require("../../models/AppConfig/Faq");

// GET /api/app/faqs — Public (React Native app)
exports.getFaqs = async (req, res) => {
  try {
    const faqs = await Faq.find({ isActive: true })
      .select("question answer order")
      .sort({ order: 1, createdAt: 1 });
    res.json({ success: true, total: faqs.length, data: faqs });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin/app/faqs — Admin
exports.getAllFaqsAdmin = async (req, res) => {
  try {
    const faqs = await Faq.find().sort({ order: 1, createdAt: 1 });
    res.json({ success: true, total: faqs.length, data: faqs });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/admin/app/faqs — Admin
exports.addFaq = async (req, res) => {
  try {
    const { question, answer, order } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ success: false, message: "question and answer are required" });
    }
    const faq = await Faq.create({ question, answer, order });
    res.status(201).json({ success: true, data: faq });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/admin/app/faqs/:id — Admin
exports.updateFaq = async (req, res) => {
  try {
    const faq = await Faq.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!faq) return res.status(404).json({ success: false, message: "FAQ not found" });
    res.json({ success: true, data: faq });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/admin/app/faqs/:id/toggle — Admin
exports.toggleFaq = async (req, res) => {
  try {
    const faq = await Faq.findById(req.params.id);
    if (!faq) return res.status(404).json({ success: false, message: "FAQ not found" });
    faq.isActive = !faq.isActive;
    await faq.save();
    res.json({ success: true, data: { isActive: faq.isActive } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE /api/admin/app/faqs/:id — Admin
exports.deleteFaq = async (req, res) => {
  try {
    const faq = await Faq.findByIdAndDelete(req.params.id);
    if (!faq) return res.status(404).json({ success: false, message: "FAQ not found" });
    res.json({ success: true, message: "FAQ deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
