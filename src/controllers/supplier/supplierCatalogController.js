const SupplierItem = require("../../models/supplier/supplierCatalog");
const PlatformItem = require("../../models/masterData/PlatformItem");
const Country = require("../../models/masterData/Country");
const Branch = require("../../models/Branch");

// ═══════════════════════════════════════════════════════════
//  SUPPLIER — Add Item to Catalog
//  POST /api/catalog/add
//  Auth: Branch token (Supplier only)
// ═══════════════════════════════════════════════════════════
exports.addItem = async (req, res) => {
  
  try {
    const branch = req.branch;
    if (branch.accountType !== "Supplier") {
      return res.status(403).json({
        success: false,
        message: "Only supplier branches can add catalog items",
      });
    }

    if (branch.registrationStep < 2) {
      return res.status(400).json({
        success: false,
        message: "Please complete your profile first (address + bank details)",
      });
    }

    const { platformItemId, countryId, pricePerUnit } = req.body;

    if (!platformItemId || !countryId || !pricePerUnit) {
      return res.status(400).json({
        success: false,
        message: "platformItemId, countryId, and pricePerUnit are required",
      });
    }

    const platformItem = await PlatformItem.findById(platformItemId).populate("categoryId", "name");
    if (!platformItem || !platformItem.isActive) {
      return res.status(404).json({ success: false, message: "Item not found or inactive" });
    }

    const country = await Country.findById(countryId);
    if (!country || !country.isActive) {
      return res.status(404).json({ success: false, message: "Country not found or inactive" });
    }

    const supplierItem = await SupplierItem.create({
      branchId:      branch._id,
      companyId:     branch.companyId,
      platformItemId,
      categoryId:    platformItem.categoryId._id,
      countryId,
      pricePerUnit,
    });

    if (branch.registrationStep < 3) {
      await Branch.findByIdAndUpdate(branch._id, { registrationStep: 3 });
    }

    await supplierItem.populate([
      { path: "platformItemId", select: "name image unit" },
      { path: "categoryId",    select: "name" },
      { path: "countryId",     select: "name code" },
    ]);

    res.status(201).json({
      success: true,
      message: "Item added to catalog successfully",
      data: {
        _id:             supplierItem._id,
        item:            supplierItem.platformItemId,
        category:        supplierItem.categoryId,
        country:         supplierItem.countryId,
        pricePerUnit:    supplierItem.pricePerUnit,
        isListed:        supplierItem.isListed,
        isAvailableToday: supplierItem.isAvailableToday,
        registrationStep: 3,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already listed this item from this country",
      });
    }
    console.error("addItem error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  SUPPLIER — Get My Catalog
//  GET /api/catalog/my-items
//  Auth: Branch token
// ═══════════════════════════════════════════════════════════
exports.getMyItems = async (req, res) => {
  console.log("DEBUG:", req.branch); // 👈 yeh add karo
  try {
    const items = await SupplierItem.find({ branchId: req.branch._id })
      .populate("platformItemId", "name image unit")
      .populate("categoryId",     "name")
      .populate("countryId",      "name code")
      .sort({ createdAt: -1 });

    res.json({ success: true, total: items.length, data: items });
  } catch (err) {
    console.error("getMyItems error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  SUPPLIER — Update Item Price
//  PUT /api/catalog/:itemId
//  Auth: Branch token
// ═══════════════════════════════════════════════════════════
exports.updateItem = async (req, res) => {
  try {
    const { pricePerUnit } = req.body;

    if (!pricePerUnit) {
      return res.status(400).json({ success: false, message: "pricePerUnit is required" });
    }

    const item = await SupplierItem.findOne({
      _id:      req.params.itemId,
      branchId: req.branch._id,
    });

    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    item.pricePerUnit = pricePerUnit;
    await item.save();

    res.json({ success: true, message: "Price updated", data: { pricePerUnit: item.pricePerUnit } });
  } catch (err) {
    console.error("updateItem error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  SUPPLIER — Toggle Listed (show/hide)
//  PUT /api/catalog/:itemId/toggle-listed
//  Auth: Branch token
// ═══════════════════════════════════════════════════════════
exports.toggleListed = async (req, res) => {
  try {
    const item = await SupplierItem.findOne({
      _id:      req.params.itemId,
      branchId: req.branch._id,
    });

    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    item.isListed = !item.isListed;
    await item.save();

    res.json({
      success: true,
      message: `Item ${item.isListed ? "listed" : "delisted"}`,
      data: { isListed: item.isListed },
    });
  } catch (err) {
    console.error("toggleListed error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  SUPPLIER — Toggle Available Today
//  PUT /api/catalog/:itemId/toggle-available
//  Auth: Branch token
// ═══════════════════════════════════════════════════════════
exports.toggleAvailable = async (req, res) => {
  try {
    const item = await SupplierItem.findOne({
      _id:      req.params.itemId,
      branchId: req.branch._id,
    });

    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    item.isAvailableToday = !item.isAvailableToday;
    await item.save();

    res.json({
      success: true,
      message: `Item ${item.isAvailableToday ? "available" : "unavailable"} today`,
      data: { isAvailableToday: item.isAvailableToday },
    });
  } catch (err) {
    console.error("toggleAvailable error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  SUPPLIER — Delete Item
//  DELETE /api/catalog/:itemId
//  Auth: Branch token
// ═══════════════════════════════════════════════════════════
exports.deleteItem = async (req, res) => {
  try {
    const item = await SupplierItem.findOneAndDelete({
      _id:      req.params.itemId,
      branchId: req.branch._id,
    });

    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    res.json({ success: true, message: "Item removed from catalog" });
  } catch (err) {
    console.error("deleteItem error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════════
//  ADMIN — Get All Supplier Items (with filters)
//  GET /api/catalog/admin/all
//  GET /api/catalog/admin/all?branchId=xx
//  GET /api/catalog/admin/all?categoryId=xx
//  GET /api/catalog/admin/all?countryId=xx
//  Auth: Admin
// ═══════════════════════════════════════════════════════════
exports.adminGetAllItems = async (req, res) => {
  try {
    const { branchId, categoryId, countryId, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (branchId)   filter.branchId   = branchId;
    if (categoryId) filter.categoryId = categoryId;
    if (countryId)  filter.countryId  = countryId;

    const skip  = (page - 1) * limit;
    const total = await SupplierItem.countDocuments(filter);

    const items = await SupplierItem.find(filter)
      .populate("platformItemId", "name image unit")
      .populate("categoryId",     "name")
      .populate("countryId",      "name code")
      .populate("branchId",       "managerName email accountType")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      total,
      page:  Number(page),
      pages: Math.ceil(total / limit),
      data:  items,
    });
  } catch (err) {
    console.error("adminGetAllItems error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
