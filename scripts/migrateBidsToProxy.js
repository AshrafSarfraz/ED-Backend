// 📁 scripts/migrateBidsToProxy.js
// ═══════════════════════════════════════════════════════
//  Purani bids ko proxy bidding shape me le aata hai.
//
//  Purana:  pricePerUnit + status pending/won/lost/ignored/missed
//  Naya:    openBid + maxBid + joinedAt + status active/won/lost/missed
//
//  Mapping:
//    openBid  = pricePerUnit (ya 0 agar null tha)
//    maxBid   = wahi
//    joinedAt = createdAt
//    pending  → lost      (wo biddings kab ki khatam ho chuki hain)
//    ignored  → missed
//
//  ⚠️ CHALANE SE PEHLE: koi bidding LIVE nahi honi chahiye.
//     Winner cron ke baad aur agle din ke bidding start se pehle chalao.
//
//  IDEMPOTENT — kitni baar bhi chalao, jin pe openBid already set hai
//  unhe chhod deta hai.
//
//  Usage:  node scripts/migrateBidsToProxy.js
// ═══════════════════════════════════════════════════════
require("dotenv").config();
const { El_Distributor } = require("../src/config/db");
const Bid       = require("../src/models/Bid");
const BulkOrder = require("../src/models/BulkOrder");

const run = async () => {
  await new Promise((resolve, reject) => {
    if (El_Distributor.readyState === 1) return resolve();
    El_Distributor.once("connected", resolve);
    El_Distributor.once("error", reject);
  });
  console.log("✅ Connected\n");

  // ─── Safety: koi live bidding to nahi? ─────────────────
  const live = await BulkOrder.countDocuments({
    status: "bidding",
    biddingEndsAt: { $gt: new Date() },
  });
  if (live > 0) {
    console.error(`❌ ${live} bidding abhi LIVE hai. Migration rok di gayi.`);
    console.error("   Winner cron chalne ke baad dobara try karein.");
    process.exit(1);
  }

  const col = El_Distributor.collection("bids");

  const pending = await col.countDocuments({ openBid: { $exists: false } });
  console.log(`📦 ${pending} bid(s) migrate karni hain\n`);

  if (pending === 0) {
    console.log("✅ Kuch karne ko nahi — pehle se migrated hai");
    process.exit(0);
  }

  // ─── 1. openBid / maxBid / joinedAt ────────────────────
  const r1 = await col.updateMany(
    { openBid: { $exists: false } },
    [
      {
        $set: {
          openBid:  { $ifNull: ["$pricePerUnit", 0] },
          maxBid:   { $ifNull: ["$pricePerUnit", 0] },
          joinedAt: { $ifNull: ["$createdAt", new Date()] },
        },
      },
    ]
  );
  console.log(`   openBid/maxBid/joinedAt set  → ${r1.modifiedCount}`);

  // ─── 2. status remap ───────────────────────────────────
  const r2 = await col.updateMany({ status: "pending" }, { $set: { status: "lost" } });
  console.log(`   pending → lost               → ${r2.modifiedCount}`);

  const r3 = await col.updateMany({ status: "ignored" }, { $set: { status: "missed" } });
  console.log(`   ignored → missed             → ${r3.modifiedCount}`);

  // ─── 3. purana field hata do ───────────────────────────
  const r4 = await col.updateMany(
    { pricePerUnit: { $exists: true } },
    { $unset: { pricePerUnit: "" } }
  );
  console.log(`   pricePerUnit removed         → ${r4.modifiedCount}`);

  // ─── 4. closed bulk orders pe currentBid backfill ──────
  const awarded = await BulkOrder.find({
    winningPrice: { $ne: null },
    currentBid:   null,
  }).select("_id winningPrice winnerSupplierId");

  let backfilled = 0;
  for (const b of awarded) {
    await BulkOrder.updateOne(
      { _id: b._id },
      { $set: { currentBid: b.winningPrice, currentLeaderId: b.winnerSupplierId } }
    );
    backfilled += 1;
  }
  console.log(`   BulkOrder currentBid backfill → ${backfilled}`);

  console.log("\n✅ Migration complete");
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
