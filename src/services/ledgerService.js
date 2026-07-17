// 📁 services/ledgerService.js
// ═══════════════════════════════════════════════════════
//  Sab ledger read/write yahan se hote hain — koi controller directly
//  Invoice.amountDue ya kisi field ko +/- nahi karta supplier/rider money ke liye.
//  Balance hamesha entries se compute hota hai, kabhi cache nahi hota.
// ═══════════════════════════════════════════════════════
const LedgerEntry = require("../models/ledger/LedgerEntry");
const Payout      = require("../models/ledger/Payout");

// ─── Write a single entry (idempotent per invoice+category+entityType) ───
async function addEntry({ entityType, entityId, direction, amount, category, invoiceId, bulkOrderId, buyerOrderId, returnOrderId, note }) {
  if (!amount || amount <= 0) return null; // zero-amount entries are pointless
  try {
    return await LedgerEntry.create({
      entityType, entityId, direction, amount: Math.round(amount * 100) / 100, category,
      invoiceId: invoiceId || null, bulkOrderId: bulkOrderId || null,
      buyerOrderId: buyerOrderId || null, returnOrderId: returnOrderId || null,
      note: note || null,
    });
  } catch (err) {
    // duplicate (already credited/debited for this invoice+category) — safe no-op
    if (err.code === 11000) return null;
    throw err;
  }
}

const creditSupplier = (entityId, amount, category, refs = {}, note = null) =>
  addEntry({ entityType: "supplier", entityId, direction: "credit", amount, category, note, ...refs });
const debitSupplier = (entityId, amount, category, refs = {}, note = null) =>
  addEntry({ entityType: "supplier", entityId, direction: "debit", amount, category, note, ...refs });
const creditRider = (entityId, amount, category, refs = {}, note = null) =>
  addEntry({ entityType: "rider", entityId, direction: "credit", amount, category, note, ...refs });
const debitRider = (entityId, amount, category, refs = {}, note = null) =>
  addEntry({ entityType: "rider", entityId, direction: "debit", amount, category, note, ...refs });
const creditPlatform = (amount, category, refs = {}, note = null) =>
  addEntry({ entityType: "platform", entityId: PLATFORM_ID, direction: "credit", amount, category, note, ...refs });

// Platform has no real "entity" — use a fixed constant ObjectId-like string sentinel
const { Types } = require("mongoose");
const PLATFORM_ID = new Types.ObjectId("000000000000000000000001");

// ─── Balance = sum(credits) - sum(debits), optionally only unsettled ───
async function getBalance(entityType, entityId, { onlyUnsettled = false } = {}) {
  const match = { entityType, entityId: new Types.ObjectId(entityId) };
  if (onlyUnsettled) match.settled = false;

  const rows = await LedgerEntry.aggregate([
    { $match: match },
    { $group: { _id: "$direction", total: { $sum: "$amount" } } },
  ]);

  const credit = rows.find(r => r._id === "credit")?.total || 0;
  const debit  = rows.find(r => r._id === "debit")?.total  || 0;
  return Math.round((credit - debit) * 100) / 100;
}

// ─── Entries list for an entity, optional date range ───
async function getEntries(entityType, entityId, { start, end, onlyUnsettled } = {}) {
  const filter = { entityType, entityId };
  if (start || end) {
    filter.createdAt = {};
    if (start) filter.createdAt.$gte = start;
    if (end)   filter.createdAt.$lt  = end;
  }
  if (onlyUnsettled) filter.settled = false;
  return LedgerEntry.find(filter).sort({ createdAt: -1 }).lean();
}

// ─── Settle unsettled entries matching a filter + create a Payout record ───
async function settleAndPayout({ entityType, entityId, start, end, extraFilter, transactionRef, note, paidBy }) {
  const filter = { entityType, entityId, settled: false };
  if (start || end) {
    filter.createdAt = {};
    if (start) filter.createdAt.$gte = start;
    if (end)   filter.createdAt.$lt  = end;
  }
  if (extraFilter) Object.assign(filter, extraFilter);

  const entries = await LedgerEntry.find(filter);
  if (entries.length === 0) return null;

  const netAmount = entries.reduce((s, e) => s + (e.direction === "credit" ? e.amount : -e.amount), 0);
  const now = new Date();

  const payout = await Payout.create({
    entityType, entityId,
    amount:     Math.round(netAmount * 100) / 100,
    entryCount: entries.length,
    transactionRef: transactionRef || null,
    note:           note || null,
    paidBy:         paidBy || null,
    paidAt:         now,
  });

  await LedgerEntry.updateMany(
    { _id: { $in: entries.map(e => e._id) } },
    { settled: true, settledAt: now, payoutId: payout._id }
  );

  return { payout, netAmount: payout.amount, entryCount: entries.length };
}

// ─── Which distinct entities (of a type) have unsettled entries in a date range ───
async function getUnsettledEntityIds(entityType, { start, end } = {}) {
  const match = { entityType, settled: false };
  if (start || end) {
    match.createdAt = {};
    if (start) match.createdAt.$gte = start;
    if (end)   match.createdAt.$lt  = end;
  }
  return LedgerEntry.distinct("entityId", match);
}

module.exports = {
  addEntry, creditSupplier, debitSupplier, creditRider, debitRider, creditPlatform,
  getBalance, getEntries, settleAndPayout, getUnsettledEntityIds, PLATFORM_ID,
};
