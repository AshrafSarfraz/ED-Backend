const Bid          = require("../../models/Bid");
const BulkOrder    = require("../../models/BulkOrder");
const SupplierItem = require("../../models/supplier/supplierCatalog");
const PlatformItem = require("../../models/PlatformItem");
const Country      = require("../../models/Country");

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Active Biddings dekho
//  GET /api/supplier/bids/active
// ═══════════════════════════════════════════════════════
exports.getActiveBiddings = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }

    const supplierItems = await SupplierItem.find({
      branchId:         req.branch._id,
      isListed:         true,
      isAvailableToday: true,
    });

    if (supplierItems.length === 0) {
      return res.json({ success: true, total: 0, data: [] });
    }

    const combinations = supplierItems.map(item => ({
      platformItemId: item.platformItemId.toString(),
      countryId:      item.countryId.toString(),
    }));

    const activeBulkOrders = await BulkOrder.find({ status: "bidding" });

    const eligibleOrders = activeBulkOrders.filter(bulk =>
      combinations.some(
        c =>
          c.platformItemId === bulk.platformItemId.toString() &&
          c.countryId      === bulk.countryId.toString()
      )
    );

    const result = await Promise.all(
      eligibleOrders.map(async (bulk) => {
        const platformItem = await PlatformItem.findById(bulk.platformItemId).select("name image unit");
        const country      = await Country.findById(bulk.countryId).select("name code");

        const myBid = await Bid.findOne({
          bulkOrderId:      bulk._id,
          supplierBranchId: req.branch._id,
        });

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
          minPrice:      bulk.minPrice,   // ← add
          maxPrice:      bulk.maxPrice,   // ← add
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

    const bulkOrder = await BulkOrder.findById(bulkOrderId);
    if (!bulkOrder || bulkOrder.status !== "bidding") {
      return res.status(404).json({ success: false, message: "Bidding not found or already closed" });
    }

    // ─── Max price check ──────────────────────────────
    if (bulkOrder.maxPrice && pricePerUnit > bulkOrder.maxPrice) {
      return res.status(400).json({
        success: false,
        message: `Bid price cannot exceed maximum price of ${bulkOrder.maxPrice} QAR/${bulkOrder.unit || "unit"}`,
      });
    }

   

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

    const existingBid = await Bid.findOne({
      bulkOrderId:      bulkOrderId,
      supplierBranchId: req.branch._id,
    });

    if (existingBid) {
      existingBid.pricePerUnit = pricePerUnit;
      await existingBid.save();
      return res.json({
        success: true,
        message: "Bid updated successfully",
        data: existingBid,
      });
    }

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
// ═══════════════════════════════════════════════════════
exports.getMyBids = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }

    // Supplier ke items
    const supplierItems = await SupplierItem.find({
      branchId: req.branch._id,
      isListed: true,
    });

    const combinations = supplierItems.map(item => ({
      platformItemId: item.platformItemId.toString(),
      countryId:      item.countryId.toString(),
    }));

    // Sare completed BulkOrders (awarded + cancelled)
    const allBulkOrders = await BulkOrder.find({
      status: { $in: ["bidding", "awarded", "cancelled", "ready"] },
    });

    // Sirf eligible BulkOrders
    const eligibleBulkOrders = allBulkOrders.filter(bulk =>
      combinations.some(
        c =>
          c.platformItemId === bulk.platformItemId.toString() &&
          c.countryId      === bulk.countryId.toString()
      )
    );

    const result = await Promise.all(
      eligibleBulkOrders.map(async (bulk) => {
        const platformItem = await PlatformItem.findById(bulk.platformItemId).select("name unit image");
        const country      = await Country.findById(bulk.countryId).select("name");

        // Meri bid
        const myBid = await Bid.findOne({
          bulkOrderId:      bulk._id,
          supplierBranchId: req.branch._id,
        });

        // Winner bid
        const winningBid = await Bid.findOne({
          bulkOrderId: bulk._id,
          status:      "won",
        });

        let bidStatus;
        if (bulk.status === "bidding") {
          bidStatus = myBid ? "pending" : "not_bid";
        } else if (!myBid) {
          bidStatus = "missed";       // eligible tha par bid nahi lagayi
        } else {
          bidStatus = myBid.status;   // won / lost
        }

        return {
          bulkOrderId:   bulk._id,
          itemName:      platformItem?.name,
          itemImage:     platformItem?.image,
          unit:          platformItem?.unit,
          country:       country?.name,
          totalQuantity: bulk.totalQuantity,
          minPrice:      bulk.minPrice,
          maxPrice:      bulk.maxPrice,
          biddingEndsAt: bulk.biddingEndsAt,
          bulkStatus:    bulk.status,

          // Meri bid info
          myPrice:       myBid?.pricePerUnit || null,
          bidStatus,                           // won/lost/missed/pending/not_bid

          // Winner info
          winningPrice:  bulk.winningPrice || null,
          iWon:          myBid?.status === "won",
        };
      })
    );

    // Sort by latest
    result.sort((a, b) => new Date(b.biddingEndsAt) - new Date(a.biddingEndsAt));

    res.json({ success: true, total: result.length, data: result });
  } catch (err) {
    console.error("getMyBids error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};