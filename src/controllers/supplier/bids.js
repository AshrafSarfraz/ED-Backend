// 📁 controllers/supplier/bids.js
const Bid          = require("../../models/Bid");
const BulkOrder    = require("../../models/BulkOrder");
const BuyerOrder   = require("../../models/buyer/buyerOrder");
const SupplierItem = require("../../models/supplier/supplierCatalog");
const PlatformItem = require("../../models/masterData/PlatformItem");
const Country      = require("../../models/masterData/Country");

// ─── kitne supplier is item+country pe eligible hain ───
const countActiveSuppliers = async (platformItemId, countryId) => {
  const items = await SupplierItem.find({
    platformItemId,
    countryId,
    isListed:         true,
    isAvailableToday: true,
  }).select("branchId");
  const unique = new Set(items.map(i => i.branchId.toString()));
  return unique.size;
};

// ─── meri bid ka rank (1 = lowest/best) + total bids ───
const getMyRank = async (bulkOrderId, myPrice) => {
  if (myPrice == null) return { rank: null, totalBids: 0 };
  const allBids = await Bid.find({
    bulkOrderId,
    pricePerUnit: { $ne: null },
  }).sort({ pricePerUnit: 1, createdAt: 1 });

  const totalBids = allBids.length;
  const idx = allBids.findIndex(b => b.pricePerUnit === myPrice);
  return { rank: idx >= 0 ? idx + 1 : null, totalBids };
};

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Active Biddings  (sirf LIVE window me)
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

    const result = [];
    const now = new Date();

    for (const bulk of eligibleOrders) {
      // ─── Sirf LIVE window me dikhao (time se pehle/baad nahi) ───
      if (bulk.bidDate && now < new Date(bulk.bidDate)) continue;          // abhi shuru nahi hui
      if (bulk.biddingEndsAt && now >= new Date(bulk.biddingEndsAt)) continue; // khatam ho gayi

      const myRecord = await Bid.findOne({
        bulkOrderId:      bulk._id,
        supplierBranchId: req.branch._id,
      });

      if (myRecord && myRecord.status === "ignored") continue;

      const platformItem = await PlatformItem.findById(bulk.platformItemId).select("name image unit");
      const country      = await Country.findById(bulk.countryId).select("name code");

      const lowestBid = await Bid.findOne({
        bulkOrderId:  bulk._id,
        pricePerUnit: { $ne: null },
      }).sort({ pricePerUnit: 1 });

      const myPrice             = myRecord?.pricePerUnit ?? null;
      const { rank, totalBids } = await getMyRank(bulk._id, myPrice);
      const activeSuppliers     = await countActiveSuppliers(bulk.platformItemId, bulk.countryId);

      const buyerCount = bulk.buyerOrderIds?.length || 0;

      result.push({
        bulkOrderId:     bulk._id,
        orderNumber:     `#ORD-${bulk._id.toString().slice(-6).toUpperCase()}`,
        itemName:        platformItem?.name,
        itemImage:       platformItem?.image,
        unit:            platformItem?.unit,
        country:         country?.name,
        countryCode:     country?.code,
        totalQuantity:   bulk.totalQuantity,
        buyerCount,
        bidDate:         bulk.bidDate,
        biddingEndsAt:   bulk.biddingEndsAt,
        minPrice:        bulk.minPrice,
        maxPrice:        bulk.maxPrice,
        orderValue:      bulk.maxPrice ? Math.round(bulk.maxPrice * bulk.totalQuantity) : null,
        activeSuppliers,
        myBid:           myPrice,
        myRank:          rank,
        totalBids,
        lowestBid:       lowestBid ? lowestBid.pricePerUnit : null,
        alreadyBid:      !!(myRecord && myRecord.status === "pending"),
      });
    }

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

    // ─── Sirf LIVE window me bid (time se pehle/baad nahi) ───
    const now = new Date();
    if (bulkOrder.bidDate && now < new Date(bulkOrder.bidDate)) {
      return res.status(400).json({ success: false, message: "Bidding has not started yet" });
    }
    if (bulkOrder.biddingEndsAt && now >= new Date(bulkOrder.biddingEndsAt)) {
      return res.status(400).json({ success: false, message: "Bidding has already closed" });
    }

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

    const existing = await Bid.findOne({
      bulkOrderId:      bulkOrderId,
      supplierBranchId: req.branch._id,
    });

    if (existing) {
      // ignored tha to ab bid me badal do
      existing.pricePerUnit = pricePerUnit;
      existing.status       = "pending";
      await existing.save();
      return res.json({
        success: true,
        message: "Bid updated successfully",
        data: existing,
      });
    }

    const bid = await Bid.create({
      bulkOrderId,
      supplierBranchId:  req.branch._id,
      supplierCompanyId: req.branch.companyId,
      pricePerUnit,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Bid placed successfully! Lowest bid wins when bidding closes.",
      data: bid,
    });
  } catch (err) {
    console.error("placeBid error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Ignore Bidding (save + all-ignored turant cancel)
//  POST /api/supplier/bids/ignore
// ═══════════════════════════════════════════════════════
exports.ignoreBidding = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }

    const { bulkOrderId } = req.body;
    if (!bulkOrderId) {
      return res.status(400).json({ success: false, message: "bulkOrderId required" });
    }

    const bulkOrder = await BulkOrder.findById(bulkOrderId);
    if (!bulkOrder || bulkOrder.status !== "bidding") {
      return res.status(404).json({ success: false, message: "Bidding not found or already closed" });
    }

    const supplierItem = await SupplierItem.findOne({
      branchId:       req.branch._id,
      platformItemId: bulkOrder.platformItemId,
      countryId:      bulkOrder.countryId,
      isListed:       true,
    });
    if (!supplierItem) {
      return res.status(403).json({ success: false, message: "You are not eligible for this item" });
    }

    const existing = await Bid.findOne({
      bulkOrderId:      bulkOrderId,
      supplierBranchId: req.branch._id,
    });

    if (existing && existing.status === "pending") {
      return res.status(400).json({
        success: false,
        message: "You have already placed a bid on this item. Cannot ignore now.",
      });
    }

    if (existing) {
      existing.status       = "ignored";
      existing.pricePerUnit = null;
      await existing.save();
    } else {
      await Bid.create({
        bulkOrderId,
        supplierBranchId:  req.branch._id,
        supplierCompanyId: req.branch.companyId,
        pricePerUnit:      null,
        status:            "ignored",
      });
    }

    // ─── Agar SAARE eligible suppliers ne ignore kar diya → turant cancel ───
    const activeSuppliers = await countActiveSuppliers(
      bulkOrder.platformItemId,
      bulkOrder.countryId
    );
    const ignoredCount = await Bid.countDocuments({
      bulkOrderId: bulkOrder._id,
      status:      "ignored",
    });

    if (activeSuppliers > 0 && ignoredCount >= activeSuppliers) {
      await BulkOrder.findByIdAndUpdate(bulkOrder._id, { status: "cancelled" });
      await BuyerOrder.updateMany(
        { _id: { $in: bulkOrder.buyerOrderIds } },
        { status: "cancelled", estimatedAmount: 0 }
      );
      return res.json({
        success: true,
        message: "Bidding ignored. All suppliers ignored — order cancelled (no supplier found).",
      });
    }

    res.json({ success: true, message: "Bidding ignored." });
  } catch (err) {
    console.error("ignoreBidding error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  SUPPLIER — My Bids / Records (sab 5 status)
//  GET /api/supplier/bids/my-bids
// ═══════════════════════════════════════════════════════
exports.getMyBids = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }

    const bids = await Bid.find({ supplierBranchId: req.branch._id })
      .populate({
        path:     "bulkOrderId",
        populate: [
          { path: "platformItemId", select: "name unit image" },
          { path: "countryId",      select: "name code" },
        ],
      })
      .sort({ createdAt: -1 });

    const result = bids
      .filter(b => b.bulkOrderId)
      .map((b) => {
        const bulk = b.bulkOrderId;
        return {
          bidId:         b._id,
          bulkOrderId:   bulk._id,
          orderNumber:   `#ORD-${bulk._id.toString().slice(-6).toUpperCase()}`,
          itemName:      bulk.platformItemId?.name,
          itemImage:     bulk.platformItemId?.image,
          unit:          bulk.platformItemId?.unit,
          country:       bulk.countryId?.name,
          totalQuantity: bulk.totalQuantity,
          bidDate:       bulk.bidDate,
          biddingEndsAt: bulk.biddingEndsAt,
          bulkStatus:    bulk.status,
          status:        b.status,           // pending/won/lost/ignored/missed
          myPrice:       b.pricePerUnit,
          minPrice:      bulk.minPrice,
          maxPrice:      bulk.maxPrice,
          winnerRate:    bulk.winningPrice ?? null,
          iWon:          b.status === "won",
        };
      });

    res.json({ success: true, total: result.length, data: result });
  } catch (err) {
    console.error("getMyBids error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};