const BuyerOrder = require("../../models/buyer/buyerOrder");
const PlatformItem = require("../../models/PlatformItem");
const Country = require("../../models/Country");

exports.placeOrder = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can place orders" });
    }

    const { platformItemId, countryId, quantity } = req.body;

    if (!platformItemId || !countryId || !quantity) {
      return res.status(400).json({ success: false, message: "platformItemId, countryId, quantity required" });
    }

    const platformItem = await PlatformItem.findById(platformItemId);
    if (!platformItem) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    const country = await Country.findById(countryId);
    if (!country) {
      return res.status(404).json({ success: false, message: "Country not found" });
    }

    const now = new Date();
    const hours = now.getUTCHours() + 3;
    if (hours >= 18) {
      return res.status(400).json({
        success: false,
        message: "Order window closed. Please order before 6:00 PM for tomorrow's bidding",
      });
    }

    const bidDate = new Date();
    bidDate.setHours(0, 0, 0, 0);

    const order = await BuyerOrder.create({
      buyerBranchId:  req.branch._id,
      buyerCompanyId: req.branch.companyId,
      platformItemId,
      countryId,
      quantity,
      bidDate,
    });

    res.status(201).json({
      success: true,
      message: "Order placed! It will be included in today's bidding at 6:00 PM",
      data: order,
    });
  } catch (err) {
    console.error("placeOrder error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  BUYER — Get My Orders
//  GET /api/buyer/orders/my-orders
// ═══════════════════════════════════════════════════════
exports.getMyOrders = async (req, res) => {
  try {
    if (req.branch.accountType !== "Buyer") {
      return res.status(403).json({ success: false, message: "Only buyers can access this" });
    }

    const orders = await BuyerOrder.find({ buyerBranchId: req.branch._id })
      .populate("platformItemId", "name image unit")
      .populate("countryId", "name code")
      .sort({ createdAt: -1 });

    res.json({ success: true, total: orders.length, data: orders });
  } catch (err) {
    console.error("getMyOrders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};