const Banner = require("../../models/AppConfig/Banner");
const { uploadToFirebase } = require("../../config/uploadToFirebase");

// ─────────────────────────────────────────────────────────
//  Banner me pehle `emoji` tha — ab uski jagah `image` hai.
//  Admin file upload karta hai (field name: "image"), jo Firebase
//  Storage me `banner-images/` folder me jaati hai aur uska URL
//  DB me save hota hai.
//  Image hatani ho to update me `removeImage: "true"` bhejein.
// ─────────────────────────────────────────────────────────

// GET /api/app-config/banners — Public (React Native app)
// Returns only active banners sorted by order
exports.getBanners = async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true })
      .select("tag title subtitle image bg waNumber waText order")
      .sort({ order: 1, createdAt: 1 });
    res.json({ success: true, total: banners.length, data: banners });
  } catch (err) {
    console.error("getBanners error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/app-config/banners/all — Admin (all banners including inactive)
exports.getAllBannersAdmin = async (req, res) => {
  try {
    const banners = await Banner.find()
      .sort({ order: 1, createdAt: 1 });
    res.json({ success: true, total: banners.length, data: banners });
  } catch (err) {
    console.error("getAllBannersAdmin error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/app-config/banners — Admin
// multipart/form-data  |  file field: "image"
exports.addBanner = async (req, res) => {
  try {
    const { tag, title, subtitle, bg, waNumber, waText, order } = req.body;

    if (!tag || !title || !bg || !waNumber || !waText) {
      return res.status(400).json({
        success: false,
        message: "tag, title, bg, waNumber, waText are required",
      });
    }

    // ─── Image upload ───────────────────────────────────
    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadToFirebase(
        req.file.buffer,
        req.file.originalname,
        "banner-images"
      );
    }

    const banner = await Banner.create({
      tag,
      title,
      subtitle,
      image: imageUrl,
      bg,
      waNumber,
      waText,
      // multipart me sab kuch string aata hai — Number me convert karna zaroori hai
      order: order !== undefined && order !== "" ? Number(order) : 0,
    });

    res.status(201).json({ success: true, data: banner });
  } catch (err) {
    console.error("addBanner error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/app-config/banners/:id — Admin
// multipart/form-data  |  file field: "image"
// Image hatane ke liye body me: removeImage = "true"
exports.updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }

    const { tag, title, subtitle, bg, waNumber, waText, order, removeImage } = req.body;

    // ─── Nayi image aayi ────────────────────────────────
    if (req.file) {
      banner.image = await uploadToFirebase(
        req.file.buffer,
        req.file.originalname,
        "banner-images"
      );
    } else if (removeImage === "true" || removeImage === true) {
      banner.image = null;
    }

    // ─── Baaki fields — sirf jo bheji gayi hain ─────────
    //  NOTE: pehle poora req.body seedha findByIdAndUpdate me jaa raha tha.
    //  Ab whitelist hai — isse (1) multipart ke extra fields DB me nahi
    //  ghusenge, (2) koi galti se isActive/_id override nahi kar sakta.
    if (tag      !== undefined) banner.tag      = tag;
    if (title    !== undefined) banner.title    = title;
    if (subtitle !== undefined) banner.subtitle = subtitle;
    if (bg       !== undefined) banner.bg       = bg;
    if (waNumber !== undefined) banner.waNumber = waNumber;
    if (waText   !== undefined) banner.waText   = waText;
    if (order    !== undefined && order !== "") banner.order = Number(order);

    await banner.save();
    res.json({ success: true, data: banner });
  } catch (err) {
    console.error("updateBanner error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/app-config/banners/:id/toggle — Admin
exports.toggleBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });
    banner.isActive = !banner.isActive;
    await banner.save();
    res.json({ success: true, data: { isActive: banner.isActive } });
  } catch (err) {
    console.error("toggleBanner error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE /api/app-config/banners/:id — Admin
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });
    res.json({ success: true, message: "Banner deleted" });
  } catch (err) {
    console.error("deleteBanner error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};