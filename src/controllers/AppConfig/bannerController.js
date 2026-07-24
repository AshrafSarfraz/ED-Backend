const Banner = require("../../models/AppConfig/Banner");

// GET /api/app/banners — Public (React Native app)
// Returns only active banners sorted by order
exports.getBanners = async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true })
      .select("tag title subtitle emoji bg waNumber waText order")
      .sort({ order: 1, createdAt: 1 });
    res.json({ success: true, total: banners.length, data: banners });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin/app/banners — Admin (all banners including inactive)
exports.getAllBannersAdmin = async (req, res) => {
  try {
    const banners = await Banner.find()
      .sort({ order: 1, createdAt: 1 });
    res.json({ success: true, total: banners.length, data: banners });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/admin/app/banners — Admin
exports.addBanner = async (req, res) => {
  try {
    const { tag, title, subtitle, emoji, bg, waNumber, waText, order } = req.body;
    if (!tag || !title || !bg || !waNumber || !waText) {
      return res.status(400).json({
        success: false,
        message: "tag, title, bg, waNumber, waText are required",
      });
    }
    const banner = await Banner.create({ tag, title, subtitle, emoji, bg, waNumber, waText, order });
    res.status(201).json({ success: true, data: banner });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/admin/app/banners/:id — Admin
exports.updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });
    res.json({ success: true, data: banner });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/admin/app/banners/:id/toggle — Admin
exports.toggleBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });
    banner.isActive = !banner.isActive;
    await banner.save();
    res.json({ success: true, data: { isActive: banner.isActive } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE /api/admin/app/banners/:id — Admin
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });
    res.json({ success: true, message: "Banner deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
