// 📁 controllers/admin/bulkOrders.js
const BulkOrder  = require("../../models/BulkOrder");
const Bid        = require("../../models/Bid");
const BuyerOrder = require("../../models/buyer/buyerOrder");

// ═══════════════════════════════════════════════════════
//  ADMIN — Bulk Orders List (Bidding History)
//  GET /api/admin/bulk-orders
//  Query: status, date, page, limit
// ═══════════════════════════════════════════════════════
exports.getBulkOrders = async (req, res) => {
  try {
    const { status, date, page = 1, limit = 20 } = req.query;

    const filter = {};

    if (status) filter.status = status;

    // Date filter
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.bidDate = { $gte: start, $lte: end };
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await BulkOrder.countDocuments(filter);

    const bulkOrders = await BulkOrder.find(filter)
      .populate("platformItemId",   "name image unit")
      .populate("countryId",        "name")
      .populate("winnerSupplierId", "managerName companyName email")
      .sort({ bidDate: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Har bulk order ke liye bids count
    const data = await Promise.all(
      bulkOrders.map(async (b) => {
        const totalBids = await Bid.countDocuments({ bulkOrderId: b._id });
        const placedBids = await Bid.countDocuments({
          bulkOrderId:  b._id,
          status:       { $nin: ["ignored", "missed"] },
          pricePerUnit: { $ne: null },
        });

        return {
          _id:            b._id,
          item:           b.platformItemId?.name,
          image:          b.platformItemId?.image,
          unit:           b.platformItemId?.unit,
          country:        b.countryId?.name,
          totalQuantity:  b.totalQuantity,
          minPrice:       b.minPrice,
          maxPrice:       b.maxPrice,
          winningPrice:   b.winningPrice,
          status:         b.status,
          bidDate:        b.bidDate,
          biddingEndsAt:  b.biddingEndsAt,
          isLate:         b.isLate,
          lateReason:     b.lateReason,
          retryCount:     b.retryCount,
          buyerCount:     b.buyerOrderIds?.length || 0,
          totalBids,
          placedBids,
          winner: b.winnerSupplierId ? {
            name:        b.winnerSupplierId.managerName,
            companyName: b.winnerSupplierId.companyName,
            email:       b.winnerSupplierId.email,
          } : null,
        };
      })
    );

    res.json({
      success: true,
      total,
      page:  Number(page),
      pages: Math.ceil(total / Number(limit)),
      data,
    });
  } catch (err) {
    console.error("getBulkOrders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Single Bulk Order Detail
//  GET /api/admin/bulk-orders/:bulkOrderId
// ═══════════════════════════════════════════════════════
exports.getBulkOrderDetail = async (req, res) => {
  try {
    const bulk = await BulkOrder.findById(req.params.bulkOrderId)
      .populate("platformItemId",   "name image unit")
      .populate("countryId",        "name")
      .populate("winnerSupplierId", "managerName companyName email phone");

    if (!bulk) {
      return res.status(404).json({ success: false, message: "Bulk order not found" });
    }

    // Sab bids fetch karo
    const bids = await Bid.find({ bulkOrderId: bulk._id })
      .populate("supplierBranchId", "managerName companyName email")
      .sort({ pricePerUnit: 1 });

    // Buyer orders
    const buyerOrders = await BuyerOrder.find({ bulkOrderId: bulk._id })
      .populate("buyerBranchId", "managerName companyName")
      .select("quantity status buyerBranchId estimatedAmount");

    const bidsData = bids.map((bid, i) => ({
      rank:         bid.status === "won" ? 1 : i + 1,
      supplierName: bid.supplierBranchId?.managerName,
      companyName:  bid.supplierBranchId?.companyName,
      email:        bid.supplierBranchId?.email,
      pricePerUnit: bid.pricePerUnit,
      status:       bid.status,
      isWinner:     bid.status === "won",
    }));

    res.json({
      success: true,
      data: {
        _id:           bulk._id,
        item:          bulk.platformItemId?.name,
        image:         bulk.platformItemId?.image,
        unit:          bulk.platformItemId?.unit,
        country:       bulk.countryId?.name,
        totalQuantity: bulk.totalQuantity,
        minPrice:      bulk.minPrice,
        maxPrice:      bulk.maxPrice,
        winningPrice:  bulk.winningPrice,
        status:        bulk.status,
        bidDate:       bulk.bidDate,
        biddingEndsAt: bulk.biddingEndsAt,
        isLate:        bulk.isLate,
        lateReason:    bulk.lateReason,
        retryCount:    bulk.retryCount,
        winner: bulk.winnerSupplierId ? {
          name:        bulk.winnerSupplierId.managerName,
          companyName: bulk.winnerSupplierId.companyName,
          email:       bulk.winnerSupplierId.email,
          phone:       bulk.winnerSupplierId.phone,
        } : null,
        bids:        bidsData,
        buyerOrders: buyerOrders.map(o => ({
          buyerName:    o.buyerBranchId?.managerName,
          companyName:  o.buyerBranchId?.companyName,
          quantity:     o.quantity,
          status:       o.status,
          estAmount:    o.estimatedAmount,
        })),
        totalBuyers: buyerOrders.length,
        totalBids:   bids.length,
      },
    });
  } catch (err) {
    console.error("getBulkOrderDetail error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
