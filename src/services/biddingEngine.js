// 📁 services/biddingEngine.js
// ═══════════════════════════════════════════════════════
//  PROXY BIDDING ENGINE
//
//  currentBid / currentLeaderId sirf YAHAN se likhe jaate hain.
//  Koi controller ya cron directly ye fields set nahi karta.
//
//  RULE:
//    sort: maxBid ascending → phir joinedAt ascending
//
//    0 participants  → currentBid = null
//    1 participant   → currentBid = uski openBid (catalog rate)
//                      ← uski maxBid NAHI. Muqabla hi nahi to margin kyun de?
//    2+              → leader   = sorted[0]
//                      runnerUp = sorted[1]
//                      currentBid = max( leader.maxBid, runnerUp.maxBid − STEP )
//                      phir clamp: min( currentBid, leader.openBid )
//
//  Do clamps zaroori hain:
//    max(...) → leader kabhi apni floor se neeche nahi jaata
//    min(...) → bid kabhi leader ki opening se upar nahi jaati
// ═══════════════════════════════════════════════════════
const BulkOrder  = require("../models/BulkOrder");
const Bid        = require("../models/Bid");
const BidHistory = require("../models/BidHistory");

const STEP = 0.01;

// ⚠️ JS float: 4.90 - 0.01 = 4.890000000000001
//    Bina rounding ke ye number seedha invoice pe chala jayega.
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ─────────────────────────────────────────────────────────
//  Ek bidding ko scratch se recompute karo
//
//  @returns { currentBid, leaderId, previousLeaderId, leaderChanged,
//             participantCount }
// ─────────────────────────────────────────────────────────
const recompute = async (bulkOrderId) => {
  const bulk = await BulkOrder.findById(bulkOrderId).select("currentLeaderId").lean();
  if (!bulk) return null;

  const bids = await Bid.find({ bulkOrderId, status: "active" })
    .sort({ maxBid: 1, joinedAt: 1 })
    .select("supplierBranchId maxBid openBid")
    .lean();

  let currentBid = null;
  let leaderId   = null;

  if (bids.length === 1) {
    // Akela hai — koi harane wala nahi, apni catalog rate pe rukta hai
    leaderId   = bids[0].supplierBranchId;
    currentBid = r2(bids[0].openBid);
  } else if (bids.length >= 2) {
    const leader   = bids[0];
    const runnerUp = bids[1];

    currentBid = Math.max(leader.maxBid, r2(runnerUp.maxBid - STEP)); // apni floor se neeche nahi
    currentBid = r2(Math.min(currentBid, leader.openBid));            // apni opening se upar nahi
    leaderId   = leader.supplierBranchId;
  }

  const prevLeader = bulk.currentLeaderId ? String(bulk.currentLeaderId) : null;
  const newLeader  = leaderId ? String(leaderId) : null;

  await BulkOrder.updateOne(
    { _id: bulkOrderId },
    { $set: { currentBid, currentLeaderId: leaderId } }
  );

  return {
    currentBid,
    leaderId,
    previousLeaderId: prevLeader,
    leaderChanged:    prevLeader !== newLeader,
    participantCount: bids.length,
  };
};

// ─────────────────────────────────────────────────────────
//  PER-BIDDING LOCK
//
//  recompute() read-modify-write hai aur ab har join / har max
//  update pe chalta hai. Do supplier ek hi lamhe me action lein to
//  currentBid galat likh jayegi — bina kisi error ke. Ye paisa hai.
//
//  Stale escape: koi request lock hold karte hue crash ho jaye to
//  LOCK_STALE_MS ke baad agla request lock chheen lega, warna wo
//  bidding hamesha ke liye atak jayegi.
// ─────────────────────────────────────────────────────────
const LOCK_STALE_MS = 10000;

const withBiddingLock = async (bulkOrderId, fn) => {
  const got = await BulkOrder.findOneAndUpdate(
    {
      _id: bulkOrderId,
      $or: [
        { recomputing: { $ne: true } },
        { recomputingAt: { $lt: new Date(Date.now() - LOCK_STALE_MS) } },
      ],
    },
    { $set: { recomputing: true, recomputingAt: new Date() } }
  );

  if (!got) {
    const e = new Error("Bidding is busy, please try again");
    e.status = 409;
    throw e;
  }

  try {
    return await fn();
  } finally {
    await BulkOrder.updateOne({ _id: bulkOrderId }, { $set: { recomputing: false } });
  }
};

// ─────────────────────────────────────────────────────────
//  Audit log — kabhi throw nahi karta (log fail ho to bid na rukay)
// ─────────────────────────────────────────────────────────
const logHistory = async (payload) => {
  try {
    await BidHistory.create({ ...payload, at: new Date() });
  } catch (err) {
    console.error("BidHistory write failed:", err.message);
  }
};

module.exports = { recompute, withBiddingLock, logHistory, STEP, r2 };
