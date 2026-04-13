const SupplierItem = require("../../models/supplier/supplierCatalog");
const PlatformItem = require("../../models/PlatformItem");
const Category = require("../../models/Category");
const Country = require("../../models/Country");

exports.getCatalogItems = async (req, res) => {
  try {
    const grouped = await SupplierItem.aggregate([
      { $match: { isListed: true, isAvailableToday: true } },
      {
        $group: {
          _id: {
            platformItemId: "$platformItemId",  // ← item
            countryId:      "$countryId",        // ← country
          },
          minPrice:      { $min: "$pricePerUnit" },
          maxPrice:      { $max: "$pricePerUnit" },
          supplierCount: { $sum: 1 },
          categoryId:    { $first: "$categoryId" },
        }
      }
    ]);

    const items = await Promise.all(
      grouped.map(async (g) => {
        const platformItem = await PlatformItem.findById(g._id.platformItemId).select("name image unit");
        const category     = await Category.findById(g.categoryId).select("name");
        const country      = await Country.findById(g._id.countryId).select("name code");

        return {
          platformItemId: g._id.platformItemId,
          countryId:      g._id.countryId,
          name:           platformItem?.name,
          image:          platformItem?.image,
          unit:           platformItem?.unit,
          category:       category?.name,
          country:        country?.name,
          countryCode:    country?.code,
          minPrice:       g.minPrice,
          maxPrice:       g.maxPrice,
          supplierCount:  g.supplierCount,
        };
      })
    );

    res.json({ success: true, total: items.length, data: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};