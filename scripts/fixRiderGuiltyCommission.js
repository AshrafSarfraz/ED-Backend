// 📁 scripts/fixRiderGuiltyCommission.js
require("dotenv").config();
const { El_Distributor } = require("../src/config/db");
const Invoice     = require("../src/models/invoice");
const ReturnOrder = require("../src/models/returnOrder/ReturnOrder");
const LedgerEntry = require("../src/models/ledger/LedgerEntry");

let tagged = 0, alreadyTagged = 0, noInvoice = 0;
let deletedReversals = 0, noReversalFound = 0, errors = 0;

async function run() {
  await new Promise((resolve, reject) => {
    El_Distributor.once("connected", resolve);
    El_Distributor.once("error", reject);
  });
  console.log("✅ DB connected. Fixing already-resolved rider_guilty commission...\n");

  const riderGuiltyReturns = await ReturnOrder.find({ status: "resolved_rider_guilty" }).lean();
  console.log(`Found ${riderGuiltyReturns.length} resolved_rider_guilty returns...\n`);

  for (const ro of riderGuiltyReturns) {
    try {
      const invoice = await Invoice.findById(ro.invoiceId);
      if (!invoice) {
        noInvoice++;
        console.log(`  ⚠ No invoice found for return ${ro._id}`);
      } else if (invoice.returnReason !== "rider_guilty") {
        await Invoice.findByIdAndUpdate(invoice._id, { returnReason: "rider_guilty" });
        tagged++;
        console.log(`  ✓ Tagged invoice ${invoice.invoiceNumber} — returnReason: rider_guilty`);
      } else {
        alreadyTagged++;
      }

      const del = await LedgerEntry.deleteOne({
        invoiceId:  ro.invoiceId,
        entityType: "platform",
        category:   "commission_reversal",
      });
      if (del.deletedCount > 0) {
        deletedReversals++;
        console.log(`  ✓ Deleted wrong commission_reversal for return ${ro._id}`);
      } else {
        noReversalFound++;
      }
    } catch (err) {
      errors++;
      console.error(`  ✗ ReturnOrder ${ro._id}:`, err.message);
    }
  }

  console.log(`\n✅ Fix complete.`);
  console.log(`   Invoices tagged: ${tagged}`);
  console.log(`   Already tagged: ${alreadyTagged}`);
  console.log(`   Invoices not found: ${noInvoice}`);
  console.log(`   Wrong reversal entries deleted: ${deletedReversals}`);
  console.log(`   No reversal found: ${noReversalFound}`);
  console.log(`   Errors: ${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

run().catch(err => {
  console.error("❌ Fix failed:", err);
  process.exit(1);
});