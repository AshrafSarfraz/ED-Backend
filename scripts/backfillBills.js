// 📁 scripts/backfillBills.js
// ═══════════════════════════════════════════════════════
//  Purane invoices ke liye bill invoices bana do (ek baar chalana hai).
//  Aage se bidding cron khud roz bana dega.
//
//  Chalao:  node scripts/backfillBills.js
//  Safe:    idempotent hai — dobara chalao to duplicate nahi banega,
//           existing bills bas update ho jayenge.
// ═══════════════════════════════════════════════════════
require("dotenv").config();
const { El_Distributor } = require("../src/config/db");
const Invoice = require("../src/models/invoice");
const { generateDailyBills } = require("../src/services/billService");
const { getCommissionSettings } = require("../src/cron/commissionSettingService");

const run = async () => {
  await new Promise((resolve) => {
    if (El_Distributor.readyState === 1) return resolve();
    El_Distributor.once("connected", resolve);
    El_Distributor.once("open", resolve);
  });
  console.log("✅ DB connected");

  const settings = await getCommissionSettings();
  const buyerDueDays    = settings.buyerPaymentDays    || 30;
  const supplierDueDays = settings.supplierPaymentDays || 60;

  // Kaun kaun se din invoices bane the
  const dates = await Invoice.aggregate([
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } } },
    { $sort: { _id: 1 } },
  ]);

  console.log(`📅 ${dates.length} day(s) to process\n`);

  let totalBills = 0;
  for (const d of dates) {
    const dateKey = d._id;
    const result = await generateDailyBills({ dateKey, buyerDueDays, supplierDueDays });
    const n = result.buyer.size + result.supplier.size;
    totalBills += n;
    console.log(`  ${dateKey} → ${result.buyer.size} buyer bill(s), ${result.supplier.size} supplier bill(s)`);
  }

  console.log(`\n✅ Done. ${totalBills} bill(s) created/updated across ${dates.length} day(s).`);
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});
