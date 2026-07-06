const Brand = require("../../models/masterData/brands");


// GET /api/brands/all — Admin
exports.getAllBrandsAdmin = async (req, res) => {
    try {
      const brands = await Brand.find().select("name isActive").sort({ name: 1 });
      res.json({ success: true, total: brands.length, data: brands });
    } catch (err) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
  
  // POST /api/brands — Admin
  exports.addBrand = async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ success: false, message: "name is required" });
      const brand = await Brand.create({ name });
      res.status(201).json({ success: true, data: brand });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: "Brand already exists" });
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
  
  // PUT /api/brands/:id — Admin
  exports.updateBrand = async (req, res) => {
    try {
      const { name } = req.body;
      const brand = await Brand.findByIdAndUpdate(req.params.id, { name }, { new: true, runValidators: true });
      if (!brand) return res.status(404).json({ success: false, message: "Brand not found" });
      res.json({ success: true, data: brand });
    } catch (err) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
  
  // DELETE /api/brands/:id — Admin
  exports.deleteBrand = async (req, res) => {
    try {
      const brand = await Brand.findByIdAndDelete(req.params.id);
      if (!brand) return res.status(404).json({ success: false, message: "Brand not found" });
      res.json({ success: true, message: "Brand deleted successfully" });
    } catch (err) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  };