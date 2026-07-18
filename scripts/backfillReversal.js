// 📁 scripts/backfillReversal.js
// ═══════════════════════════════════════════════════════
//  ONE-TIME script — jo returns pehle hi "resolved_supplier_guilty" ho chuke hain
//  (is fix se pehle), unke liye missing "order_earning_reversal" debit banata hai.
//  Bina isko chalaye, purane resolved returns ka supplier balance galat (inflated)
//  rahega — sirf 2% penalty katti thi, 100% order_earning wapas nahi hua tha.
//
//  Chalane ka tarika (project root se):
//     node scripts/backfillReversal.js
//
//  Safe hai dobara chalana bhi — LedgerEntry ka unique index (invoiceId+category+entityType)
//  duplicate entries khud rok deta hai.
// ═══════════════════════════════════════════════════════
require("dotenv").config();
const { El_Distributor } = require("../src/config/db");
const ReturnOrder = require("../src/models/returnOrder/ReturnOrder");
const Invoice     = require("../src/models/invoice");
const LedgerEntry = require("../src/models/ledger/LedgerEntry");

let created = 0, skipped = 0, errors = 0;
let buyerCancelled = 0, buyerSkipped = 0;

async function run() {
  await new Promise((resolve, reject) => {
    El_Distributor.once("connected", resolve);
    El_Distributor.once("error", reject);
  });
  console.log("✅ DB connected. Starting reversal backfill...\n");

  const returns = await ReturnOrder.find({ status: "resolved_supplier_guilty" }).lean();
  console.log(`Found ${returns.length} resolved_supplier_guilty returns...`);

  for (const ro of returns) {
    const supplierInvoice = await Invoice.findOne({
      buyerOrderId: ro.buyerOrderId,
      invoiceType:  "supplier",
    }).lean();

    // ─── 1. Supplier ledger reversal (money) ───
    const amount = supplierInvoice?.grandTotal || ro.orderRawAmount || 0;
    if (!amount) {
      console.log(`  ⚠ Skipping return ${ro._id} — no invoice/amount found`);
    } else {
      try {
        await LedgerEntry.create({
          entityType: "supplier", entityId: ro.supplierBranchId,
          direction: "debit", amount, category: "order_earning_reversal",
          invoiceId: supplierInvoice?._id, bulkOrderId: ro.bulkOrderId, returnOrderId: ro._id,
          settled: false,
          note: `Backfilled reversal (item returned) — ${supplierInvoice?.invoiceNumber || ro._id}`,
        });
        created++;
        console.log(`  ✓ Reversed QAR ${amount} for return ${ro._id}`);
      } catch (err) {
        if (err.code === 11000) {
          skipped++; // already exists — fine
        } else {
          errors++;
          console.error(`  ✗ return ${ro._id}:`, err.message);
        }
      }
    }

    // ─── 2. Buyer invoice cancellation (so it stops showing as outstanding) ───
    const buyerInvoice = await Invoice.findOne({
      buyerOrderId: ro.buyerOrderId,
      invoiceType:  "buyer",
    });
    if (buyerInvoice && buyerInvoice.paymentStatus !== "cancelled") {
      await Invoice.findByIdAndUpdate(buyerInvoice._id, {
        paymentStatus: "cancelled",
        amountDue:     0,
        refundAmount:  buyerInvoice.amountPaid || 0,
        amountPaid:    0,
      });
      buyerCancelled++;
      console.log(`  ✓ Cancelled buyer invoice ${buyerInvoice.invoiceNumber} for return ${ro._id}`);
    } else if (buyerInvoice) {
      buyerSkipped++;
    } else {
      console.log(`  ⚠ No buyer invoice found for return ${ro._id}`);
    }
  }

  console.log(`\n✅ Backfill complete.`);
  console.log(`   Supplier reversals created: ${created}`);
  console.log(`   Supplier reversals already existed: ${skipped}`);
  console.log(`   Buyer invoices cancelled: ${buyerCancelled}`);
  console.log(`   Buyer invoices already cancelled: ${buyerSkipped}`);
  console.log(`   Errors: ${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

run().catch(err => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});