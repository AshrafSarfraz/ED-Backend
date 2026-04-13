const Bid        = require("../../models/Bid");
const BulkOrder  = require("../../models/BulkOrder");
const SupplierItem = require("../../models/supplier/supplierCatalog");
const PlatformItem = require("../../models/PlatformItem");
const Country      = require("../../models/Country");

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Active Biddings dekho
//  GET /api/supplier/bids/active
//  Auth: Supplier Token
// ═══════════════════════════════════════════════════════
exports.getActiveBiddings = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }

    // Supplier ke items dhundo
    const supplierItems = await SupplierItem.find({
      branchId:        req.branch._id,
      isListed:        true,
      isAvailableToday: true,
    });

    if (supplierItems.length === 0) {
      return res.json({ success: true, total: 0, data: [] });
    }

    // Supplier ke platformItemId + countryId combinations
    const combinations = supplierItems.map(item => ({
      platformItemId: item.platformItemId.toString(),
      countryId:      item.countryId.toString(),
    }));

    // Active BulkOrders dhundo
    const now = new Date();
    const activeBulkOrders = await BulkOrder.find({ status: "bidding" });

    // Sirf woh BulkOrders jo supplier sell karta hai
    const eligibleOrders = activeBulkOrders.filter(bulk =>
      combinations.some(
        c =>
          c.platformItemId === bulk.platformItemId.toString() &&
          c.countryId      === bulk.countryId.toString()
      )
    );

    // Populate karo
    const result = await Promise.all(
      eligibleOrders.map(async (bulk) => {
        const platformItem = await PlatformItem.findById(bulk.platformItemId).select("name image unit");
        const country      = await Country.findById(bulk.countryId).select("name code");

        // Supplier ki existing bid check karo
        const myBid = await Bid.findOne({
          bulkOrderId:      bulk._id,
          supplierBranchId: req.branch._id,
        });

        // Lowest bid abhi tak
        const lowestBid = await Bid.findOne({ bulkOrderId: bulk._id })
          .sort({ pricePerUnit: 1 });

        return {
          bulkOrderId:   bulk._id,
          itemName:      platformItem?.name,
          itemImage:     platformItem?.image,
          unit:          platformItem?.unit,
          country:       country?.name,
          countryCode:   country?.code,
          totalQuantity: bulk.totalQuantity,
          biddingEndsAt: bulk.biddingEndsAt,
          myBid:         myBid ? myBid.pricePerUnit : null,
          lowestBid:     lowestBid ? lowestBid.pricePerUnit : null,
          alreadyBid:    !!myBid,
        };
      })
    );

    res.json({ success: true, total: result.length, data: result });
  } catch (err) {
    console.error("getActiveBiddings error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Bid lagao
//  POST /api/supplier/bids/place
//  Auth: Supplier Token
// ═══════════════════════════════════════════════════════
exports.placeBid = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can place bids" });
    }

    const { bulkOrderId, pricePerUnit } = req.body;

    if (!bulkOrderId || !pricePerUnit) {
      return res.status(400).json({ success: false, message: "bulkOrderId and pricePerUnit required" });
    }

    // BulkOrder check
    const bulkOrder = await BulkOrder.findById(bulkOrderId);
    if (!bulkOrder || bulkOrder.status !== "bidding") {
      return res.status(404).json({ success: false, message: "Bidding not found or already closed" });
    }

    // Bidding time check — 6PM-10PM only
    const now        = new Date();
    const hours      = now.getUTCHours() + 3; // Qatar time
    if (hours < 18 || hours >= 22) {
      return res.status(400).json({
        success: false,
        message: "Bidding is only allowed between 6:00 PM and 10:00 PM",
      });
    }

    // Supplier is item ko sell karta hai check
    const supplierItem = await SupplierItem.findOne({
      branchId:       req.branch._id,
      platformItemId: bulkOrder.platformItemId,
      countryId:      bulkOrder.countryId,
      isListed:       true,
    });

    if (!supplierItem) {
      return res.status(403).json({
        success: false,
        message: "You are not eligible to bid on this item",
      });
    }

    // Already bid kiya check
    const existingBid = await Bid.findOne({
      bulkOrderId:      bulkOrderId,
      supplierBranchId: req.branch._id,
    });

    if (existingBid) {
      // Update existing bid
      existingBid.pricePerUnit = pricePerUnit;
      await existingBid.save();

      return res.json({
        success: true,
        message: "Bid updated successfully",
        data: existingBid,
      });
    }

    // Naya bid create karo
    const bid = await Bid.create({
      bulkOrderId,
      supplierBranchId:  req.branch._id,
      supplierCompanyId: req.branch.companyId,
      pricePerUnit,
    });

    res.status(201).json({
      success: true,
      message: "Bid placed successfully! Lowest bid wins at 10:00 PM",
      data: bid,
    });
  } catch (err) {
    console.error("placeBid error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  SUPPLIER — My Bids dekho
//  GET /api/supplier/bids/my-bids
//  Auth: Supplier Token
// ═══════════════════════════════════════════════════════
exports.getMyBids = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }

    const bids = await Bid.find({ supplierBranchId: req.branch._id })
      .populate("bulkOrderId")
      .sort({ createdAt: -1 });

    const result = await Promise.all(
      bids.map(async (bid) => {
        const bulk         = bid.bulkOrderId;
        const platformItem = await PlatformItem.findById(bulk.platformItemId).select("name unit");
        const country      = await Country.findById(bulk.countryId).select("name");

        return {
          bidId:         bid._id,
          bulkOrderId:   bulk._id,
          itemName:      platformItem?.name,
          unit:          platformItem?.unit,
          country:       country?.name,
          totalQuantity: bulk.totalQuantity,
          myPrice:       bid.pricePerUnit,
          status:        bid.status,  // pending / won / lost
          biddingEndsAt: bulk.biddingEndsAt,
        };
      })
    );

    res.json({ success: true, total: result.length, data: result });
  } catch (err) {
    console.error("getMyBids error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};