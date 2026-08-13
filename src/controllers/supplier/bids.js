// 📁 controllers/supplier/bids.js
// ═══════════════════════════════════════════════════════
//  PROXY BIDDING — supplier endpoints
//
//  join  → bidding me shamil ho. Catalog price = opening bid.
//          maxBid optional hai; na do to maxBid = openBid.
//  max   → apni max bid SIRF neeche kar sakte ho.
//  active→ live biddings + apni position.
//
//  ⚠️ Kisi doosre supplier ki maxBid kabhi kisi response me nahi jaati.
//     Poore mechanism ki jaan yahi hai.
// ═══════════════════════════════════════════════════════
const Bid          = require("../../models/Bid");
const BulkOrder    = require("../../models/BulkOrder");
const SupplierItem = require("../../models/supplier/supplierCatalog");
const { recompute, withBiddingLock, logHistory, r2 } = require("../../services/biddingEngine");
const { notifyOutbid, getTokensForBranches } = require("../../notification/notificationService");

// ─────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────
const isSupplier = (req, res) => {
  if (req.branch.accountType !== "Supplier") {
    res.status(403).json({ success: false, message: "Only suppliers can access this" });
    return false;
  }
  return true;
};

const windowIsLive = (bulk) => {
  const now = new Date();
  if (bulk.bidDate && now < new Date(bulk.bidDate)) return "Bidding has not started yet";
  if (bulk.biddingEndsAt && now >= new Date(bulk.biddingEndsAt)) return "Bidding has already closed";
  return null;
};

//  ELIGIBILITY — ek hi jagah define.
//  Pehle 3 alag definitions thi: placeBid sirf isListed dekhta tha,
//  getActiveBiddings dono, recordMissedBids sirf isListed.
const findEligibleItem = (branchId, bulk) =>
  SupplierItem.findOne({
    branchId,
    platformItemId:   bulk.platformItemId,
    countryId:        bulk.countryId,
    isListed:         true,
    isAvailableToday: true,
  }).select("pricePerUnit");

const minutesLeft = (bulk) =>
  bulk.biddingEndsAt
    ? Math.max(0, Math.round((new Date(bulk.biddingEndsAt) - Date.now()) / 60000))
    : null;

//  Jisse lead chheeni gayi usay TURANT batao.
//  10-minute reminder iska badal nahi — wo sirf backstop hai.
const pushOutbid = async (result, bulk, itemName) => {
  if (!result?.leaderChanged || !result.previousLeaderId) return;
  try {
    const tokenMap = await getTokensForBranches([result.previousLeaderId]);
    const tokens   = tokenMap.get(String(result.previousLeaderId));
    if (!tokens) return;
    await notifyOutbid(result.previousLeaderId, {
      itemName,
      currentBid:  result.currentBid,
      minutesLeft: minutesLeft(bulk),
    }, tokens);
  } catch (err) {
    console.error("Outbid push failed:", err.message);
  }
};

// ═══════════════════════════════════════════════════════
//  POST /api/supplier/bids/join
//  body: { bulkOrderId, maxBid? }
// ═══════════════════════════════════════════════════════
exports.joinBidding = async (req, res) => {
  try {
    if (!isSupplier(req, res)) return;

    const { bulkOrderId, maxBid } = req.body;
    if (!bulkOrderId) {
      return res.status(400).json({ success: false, message: "bulkOrderId required" });
    }

    const bulk = await BulkOrder.findById(bulkOrderId).populate("platformItemId", "name unit");
    if (!bulk || bulk.status !== "bidding") {
      return res.status(404).json({ success: false, message: "Bidding not found or already closed" });
    }

    const windowErr = windowIsLive(bulk);
    if (windowErr) return res.status(400).json({ success: false, message: windowErr });

    const item = await findEligibleItem(req.branch._id, bulk);
    if (!item) {
      return res.status(403).json({
        success: false,
        message: "You are not eligible for this item (not listed, or marked unavailable today)",
      });
    }

    const already = await Bid.findOne({ bulkOrderId, supplierBranchId: req.branch._id });
    if (already) {
      return res.status(409).json({
        success: false,
        message: "You have already joined this bidding. Use /max to lower your max bid.",
      });
    }

    const openBid = r2(item.pricePerUnit);

    // maxBid optional — na do to apni catalog rate pe khare ho
    let finalMax = openBid;
    if (maxBid !== undefined && maxBid !== null && maxBid !== "") {
      const m = Number(maxBid);
      if (!Number.isFinite(m) || m <= 0) {
        return res.status(400).json({ success: false, message: "Invalid max bid" });
      }
      if (m > openBid) {
        return res.status(400).json({
          success: false,
          message: `Max bid cannot be above your listed price of ${openBid}`,
        });
      }
      finalMax = r2(m);
    }

    let result;
    await withBiddingLock(bulkOrderId, async () => {
      await Bid.create({
        bulkOrderId,
        supplierBranchId:  req.branch._id,
        supplierCompanyId: req.branch.companyId,
        openBid,
        maxBid:   finalMax,
        joinedAt: new Date(),   // ← FREEZE. max lower karne pe ye nahi badlega.
        status:   "active",
      });
      result = await recompute(bulkOrderId);
    });

    await logHistory({
      bulkOrderId,
      supplierBranchId:  req.branch._id,
      supplierCompanyId: req.branch.companyId,
      action:  "join",
      openBid,
      maxBid:  finalMax,
      resultingCurrentBid: result?.currentBid ?? null,
      resultingLeaderId:   result?.leaderId ?? null,
      leaderChanged:       result?.leaderChanged ?? false,
    });

    await pushOutbid(result, bulk, bulk.platformItemId?.name);

    const leading = String(result?.leaderId || "") === String(req.branch._id);

    res.status(201).json({
      success: true,
      message: finalMax < openBid
        ? "Joined. We'll bid on your behalf down to your max — no need to stay in the app."
        : "Joined at your listed price. Set a max bid to let us defend your position automatically.",
      data: {
        currentBid:       result?.currentBid ?? null,
        youAreLeading:    leading,
        yourMaxBid:       finalMax,
        yourOpenBid:      openBid,
        participantCount: result?.participantCount ?? 1,
        biddingEndsAt:    bulk.biddingEndsAt,
        minutesRemaining: minutesLeft(bulk),
      },
    });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ success: false, message: err.message });
    }
    console.error("joinBidding error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  POST /api/supplier/bids/max
//  body: { bulkOrderId, maxBid }
//
//  Max SIRF neeche ja sakti hai. Upar karna peeche hatna hai
//  aur us se leader badal kar price ULTI chalegi.
// ═══════════════════════════════════════════════════════
exports.setMaxBid = async (req, res) => {
  try {
    if (!isSupplier(req, res)) return;

    const { bulkOrderId, maxBid } = req.body;
    if (!bulkOrderId || maxBid === undefined || maxBid === null || maxBid === "") {
      return res.status(400).json({ success: false, message: "bulkOrderId and maxBid required" });
    }

    const m = Number(maxBid);
    if (!Number.isFinite(m) || m <= 0) {
      return res.status(400).json({ success: false, message: "Invalid max bid" });
    }

    const bulk = await BulkOrder.findById(bulkOrderId).populate("platformItemId", "name unit");
    if (!bulk || bulk.status !== "bidding") {
      return res.status(404).json({ success: false, message: "Bidding not found or already closed" });
    }

    const windowErr = windowIsLive(bulk);
    if (windowErr) return res.status(400).json({ success: false, message: windowErr });

    const existing = await Bid.findOne({
      bulkOrderId,
      supplierBranchId: req.branch._id,
      status: "active",
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "You have not joined this bidding yet" });
    }

    const newMax = r2(m);
    if (newMax >= existing.maxBid) {
      return res.status(400).json({
        success: false,
        message: `A max bid can only be lowered. Your current max is ${existing.maxBid}.`,
      });
    }

    const previousMax = existing.maxBid;

    let result;
    await withBiddingLock(bulkOrderId, async () => {
      // joinedAt ko haath NAHI lagana — tie-break isi pe hai
      await Bid.updateOne({ _id: existing._id }, { $set: { maxBid: newMax } });
      result = await recompute(bulkOrderId);
    });

    await logHistory({
      bulkOrderId,
      supplierBranchId:  req.branch._id,
      supplierCompanyId: req.branch.companyId,
      action:  "lower_max",
      openBid: existing.openBid,
      maxBid:  newMax,
      previousMaxBid: previousMax,
      resultingCurrentBid: result?.currentBid ?? null,
      resultingLeaderId:   result?.leaderId ?? null,
      leaderChanged:       result?.leaderChanged ?? false,
    });

    await pushOutbid(result, bulk, bulk.platformItemId?.name);

    const leading = String(result?.leaderId || "") === String(req.branch._id);

    res.json({
      success: true,
      message: leading ? "You are now leading" : "Max bid updated — you are still behind",
      data: {
        currentBid:       result?.currentBid ?? null,
        youAreLeading:    leading,
        yourMaxBid:       newMax,
        yourOpenBid:      existing.openBid,
        participantCount: result?.participantCount ?? 0,
        biddingEndsAt:    bulk.biddingEndsAt,
        minutesRemaining: minutesLeft(bulk),
      },
    });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ success: false, message: err.message });
    }
    console.error("setMaxBid error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  GET /api/supplier/bids/active
//
//  Purana version har bulk order pe ~6 query maarta tha
//  (Bid.findOne + PlatformItem + Country + lowest bid + getMyRank +
//   countActiveSuppliers) — aur ye supplier app ki main screen hai.
//  currentBid ab BulkOrder pe cached hai, isliye 3 query kaafi hain.
// ═══════════════════════════════════════════════════════
exports.getActiveBiddings = async (req, res) => {
  try {
    if (!isSupplier(req, res)) return;

    const myItems = await SupplierItem.find({
      branchId:         req.branch._id,
      isListed:         true,
      isAvailableToday: true,
    }).select("platformItemId countryId pricePerUnit").lean();

    if (myItems.length === 0) return res.json({ success: true, total: 0, data: [] });

    // "itemId|countryId" → meri catalog price
    const myMap = new Map(
      myItems.map(i => [`${i.platformItemId}|${i.countryId}`, i.pricePerUnit])
    );

    const now = new Date();
    const bulks = await BulkOrder.find({
      status:         "bidding",
      platformItemId: { $in: myItems.map(i => i.platformItemId) },
      countryId:      { $in: myItems.map(i => i.countryId) },
      bidDate:        { $lte: now },
      biddingEndsAt:  { $gt: now },
    })
      .populate("platformItemId", "name image unit")
      .populate("countryId", "name code")
      .lean();

    // sirf wo jinme mera exact item+country combo hai
    const eligible = bulks.filter(b =>
      myMap.has(`${b.platformItemId?._id}|${b.countryId?._id}`)
    );

    if (eligible.length === 0) return res.json({ success: true, total: 0, data: [] });

    // Meri saari bids EK query me
    const myBids = await Bid.find({
      bulkOrderId:      { $in: eligible.map(b => b._id) },
      supplierBranchId: req.branch._id,
    }).select("bulkOrderId maxBid openBid status joinedAt").lean();

    const bidMap = new Map(myBids.map(b => [String(b.bulkOrderId), b]));

    const data = eligible.map((b) => {
      const mine    = bidMap.get(String(b._id));
      const leading = !!mine && String(b.currentLeaderId || "") === String(req.branch._id);
      const key     = `${b.platformItemId?._id}|${b.countryId?._id}`;

      return {
        bulkOrderId:   b._id,
        orderNumber:   `#ORD-${b._id.toString().slice(-6).toUpperCase()}`,
        itemName:      b.platformItemId?.name,
        itemImage:     b.platformItemId?.image,
        unit:          b.platformItemId?.unit,
        country:       b.countryId?.name,
        countryCode:   b.countryId?.code,
        totalQuantity: b.totalQuantity,
        buyerCount:    b.buyerOrderIds?.length || 0,
        bidDate:       b.bidDate,
        biddingEndsAt: b.biddingEndsAt,
        minutesRemaining: minutesLeft(b),
        minPrice:      b.minPrice,
        maxPrice:      b.maxPrice,

        // ─── Sabko dikhta hai ───
        currentBid:    b.currentBid ?? null,

        // ─── Sirf is supplier ka apna data ───
        hasJoined:     !!mine,
        youAreLeading: leading,
        yourMaxBid:    mine?.maxBid  ?? null,
        yourOpenBid:   mine?.openBid ?? r2(myMap.get(key)),
        //  ⚠️ kisi DOOSRE supplier ki maxBid yahan kabhi nahi aani chahiye
      };
    });

    res.json({ success: true, total: data.length, data });
  } catch (err) {
    console.error("getActiveBiddings error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  GET /api/supplier/bids/my-bids
// ═══════════════════════════════════════════════════════
exports.getMyBids = async (req, res) => {
  try {
    if (!isSupplier(req, res)) return;

    const bids = await Bid.find({ supplierBranchId: req.branch._id })
      .populate({
        path: "bulkOrderId",
        populate: [
          { path: "platformItemId", select: "name unit image" },
          { path: "countryId",      select: "name code" },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();

    const data = bids
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
          status:        b.status,       // active / won / lost / missed
          yourMaxBid:    b.maxBid,       // apni hi hai — dikhana theek hai
          yourOpenBid:   b.openBid,
          joinedAt:      b.joinedAt,
          currentBid:    bulk.currentBid ?? null,
          winnerRate:    bulk.winningPrice ?? null,
          iWon:          b.status === "won",
        };
      });

    res.json({ success: true, total: data.length, data });
  } catch (err) {
    console.error("getMyBids error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
