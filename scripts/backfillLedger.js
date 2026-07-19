// 📁 scripts/backfillLedger.js
// ═══════════════════════════════════════════════════════
//  ONE-TIME script — purane (ledger system se pehle ke) orders/invoices/returns
//  se retroactively LedgerEntry records banata hai, taake supplier/rider ke
//  purane numbers (Total Earned, Pending, etc.) bhi sahi dikhein.
//
//  Chalane ka tarika (project root se):
//     node scripts/backfillLedger.js
//
//  Safe hai dobara chalana bhi — LedgerEntry ka unique index (invoiceId+category+entityType)
//  duplicate entries khud rok deta hai, sirf naye/missing records add honge.
// ═══════════════════════════════════════════════════════
require("dotenv").config();
const { El_Distributor } = require("../src/config/db");
const Invoice        = require("../src/models/invoice");
const ReturnOrder     = require("../src/models/returnOrder/ReturnOrder");
const DeliveryOrder   = require("../src/models/riderCompany/orderDelivery");
const LedgerEntry     = require("../src/models/ledger/LedgerEntry");
const { PLATFORM_ID } = require("../src/services/ledgerService");

let created = 0, skipped = 0, errors = 0;

async function safeCreate(payload, label) {
  try {
    await LedgerEntry.create(payload);
    created++;
  } catch (err) {
    if (err.code === 11000) {
      skipped++; // already exists — fine
    } else {
      errors++;
      console.error(`  ✗ ${label}:`, err.message);
    }
  }
}

async function run() {
  await new Promise((resolve, reject) => {
    El_Distributor.once("connected", resolve);
    El_Distributor.once("error", reject);
  });
  console.log("✅ DB connected. Starting ledger backfill...\n");

  // ─── 1. Supplier order_earning — every supplier invoice ever created ───
  const supplierInvoices = await Invoice.find({ invoiceType: "supplier" }).lean();
  console.log(`Found ${supplierInvoices.length} supplier invoices...`);
  for (const inv of supplierInvoices) {
    await safeCreate({
      entityType: "supplier", entityId: inv.supplierBranchId,
      direction: "credit", amount: inv.grandTotal, category: "order_earning",
      invoiceId: inv._id, bulkOrderId: inv.bulkOrderId, buyerOrderId: inv.buyerOrderId,
      settled: inv.supplierPaymentStatus === "released",
      settledAt: inv.supplierPaidAt || null,
      note: `Backfilled — ${inv.invoiceNumber}`,
    }, `order_earning ${inv.invoiceNumber}`);
  }

  // ─── 2. Supplier return_penalty — invoices already marked "deducted" ───
  const deductedInvoices = supplierInvoices.filter(i => i.supplierPaymentStatus === "deducted");
  console.log(`Found ${deductedInvoices.length} deducted (returned) supplier invoices...`);
  for (const inv of deductedInvoices) {
    const ro = await ReturnOrder.findOne({ buyerOrderId: inv.buyerOrderId, status: "resolved_supplier_guilty" }).lean();
    if (!ro || !ro.penaltyAmount) continue;
    await safeCreate({
      entityType: "supplier", entityId: inv.supplierBranchId,
      direction: "debit", amount: ro.penaltyAmount, category: "return_penalty",
      invoiceId: inv._id, bulkOrderId: inv.bulkOrderId, returnOrderId: ro._id,
      settled: true, settledAt: ro.adminResolvedAt || ro.updatedAt,
      note: `Backfilled penalty — ${inv.invoiceNumber}`,
    }, `return_penalty ${inv.invoiceNumber}`);
  }

  // ─── 3. Platform commission — every buyer invoice with a commission amount ───
  const buyerInvoices = await Invoice.find({ invoiceType: "buyer", commissionAmount: { $gt: 0 } }).lean();
  console.log(`Found ${buyerInvoices.length} buyer invoices with commission...`);
  for (const inv of buyerInvoices) {
    await safeCreate({
      entityType: "platform", entityId: PLATFORM_ID,
      direction: "credit", amount: inv.commissionAmount, category: "commission",
      invoiceId: inv._id, bulkOrderId: inv.bulkOrderId, buyerOrderId: inv.buyerOrderId,
      settled: true, settledAt: inv.createdAt,
      note: `Backfilled — ${inv.invoiceNumber}`,
    }, `commission ${inv.invoiceNumber}`);
  }

  // ─── 4. Rider delivery_fee — every buyer invoice already marked delivered ───
  const deliveredInvoices = await Invoice.find({ invoiceType: "buyer", deliveryStatus: "delivered", deliveryAmount: { $gt: 0 } }).lean();
  console.log(`Found ${deliveredInvoices.length} delivered buyer invoices...`);
  for (const inv of deliveredInvoices) {
    const dOrder = await DeliveryOrder.findOne({ bulkOrderId: inv.bulkOrderId }).lean();
    if (!dOrder?.deliveryCompanyId) continue; // no rider assigned on record — skip
    await safeCreate({
      entityType: "rider", entityId: dOrder.deliveryCompanyId,
      direction: "credit", amount: inv.deliveryAmount, category: "delivery_fee",
      invoiceId: inv._id, bulkOrderId: inv.bulkOrderId, buyerOrderId: inv.buyerOrderId,
      settled: false, // admin can review & pay via Rider Earnings screen
      note: `Backfilled — ${inv.invoiceNumber}`,
    }, `delivery_fee ${inv.invoiceNumber}`);
  }

  // ─── 5. Rider return_leg_fee — returns already resolved as supplier_guilty ───
  const supplierGuiltyReturns = await ReturnOrder.find({ status: "resolved_supplier_guilty", deliveryCompanyId: { $ne: null } })
    .populate("invoiceId").lean();
  console.log(`Found ${supplierGuiltyReturns.length} supplier-guilty returns...`);
  for (const ro of supplierGuiltyReturns) {
    if (!ro.invoiceId?.deliveryAmount) continue;
    await safeCreate({
      entityType: "rider", entityId: ro.deliveryCompanyId,
      direction: "credit", amount: ro.invoiceId.deliveryAmount, category: "return_leg_fee",
      invoiceId: ro.invoiceId._id, bulkOrderId: ro.bulkOrderId, buyerOrderId: ro.buyerOrderId, returnOrderId: ro._id,
      settled: false,
      note: `Backfilled return-leg — ${ro.invoiceId.invoiceNumber}`,
    }, `return_leg_fee (return ${ro._id})`);
  }

  // ─── 6. Rider rider_guilty_debt — returns already resolved as rider_guilty ───
  const riderGuiltyReturns = await ReturnOrder.find({ status: "resolved_rider_guilty", deliveryCompanyId: { $ne: null } })
    .populate("invoiceId").lean();
  console.log(`Found ${riderGuiltyReturns.length} rider-guilty returns...`);
  for (const ro of riderGuiltyReturns) {
    if (!ro.invoiceId?.grandTotal) continue;
    await safeCreate({
      entityType: "rider", entityId: ro.deliveryCompanyId,
      direction: "debit", amount: ro.invoiceId.grandTotal, category: "rider_guilty_debt",
      invoiceId: ro.invoiceId._id, bulkOrderId: ro.bulkOrderId, buyerOrderId: ro.buyerOrderId, returnOrderId: ro._id,
      settled: false,
      note: `Backfilled rider debt — ${ro.invoiceId.invoiceNumber}`,
    }, `rider_guilty_debt (return ${ro._id})`);
  }

  console.log(`\n✅ Backfill complete.`);
  console.log(`   Created: ${created}`);
  console.log(`   Already existed (skipped): ${skipped}`);
  console.log(`   Errors: ${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

run().catch(err => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});