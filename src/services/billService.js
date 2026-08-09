// 📁 services/billService.js
// ═══════════════════════════════════════════════════════
//  Daily bill generation. Bidding winner cron ke END me chalta hai.
//
//  IDEMPOTENT — ek hi din pe dobara chalao to duplicate bill nahi banega,
//  purana bill update ho jayega. Isliye cron crash/retry safe hai.
//
//  Ye service KABHI throw nahi karti (sab kuch try/catch me) — bill banna
//  fail bhi ho jaye to bidding/invoice/email ka flow chalta rahega.
// ═══════════════════════════════════════════════════════
const BillInvoice = require("../models/BillInvoice");
const Invoice     = require("../models/invoice");

const DAY_MS = 24 * 60 * 60 * 1000;

// Cron ke `dateStr` jaisa hi — UTC day. Poore system me yahi grouping key hai.
const todayKey = () => new Date().toISOString().slice(0, 10);

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ─────────────────────────────────────────────────────────
//  Bill number allocate karo — BILL-B-20260806-0001
//  Sequence per (type + date) reset hoti hai.
// ─────────────────────────────────────────────────────────
const nextBillNumber = async (billType, dateKey) => {
  const prefix  = billType === "buyer" ? "BILL-B" : "BILL-S";
  const compact = dateKey.replace(/-/g, "");

  const last = await BillInvoice.findOne({ billType, billDate: dateKey })
    .sort({ billNumber: -1 })
    .select("billNumber")
    .lean();

  let seq = 1;
  if (last?.billNumber) {
    const n = parseInt(last.billNumber.split("-").pop(), 10);
    if (!isNaN(n)) seq = n + 1;
  }
  return `${prefix}-${compact}-${String(seq).padStart(4, "0")}`;
};

// ─────────────────────────────────────────────────────────
//  Ek branch ka bill upsert karo
// ─────────────────────────────────────────────────────────
const upsertBill = async ({ billType, dateKey, branchId, companyId, branchName, companyName, invoices, dueDays }) => {
  const existing = await BillInvoice.findOne({ billType, billDate: dateKey, branchId });

  const isBuyer = billType === "buyer";

  const subTotal        = r2(invoices.reduce((s, i) => s + (i.totalAmount      || 0), 0));
  const commissionTotal = r2(invoices.reduce((s, i) => s + (i.commissionAmount || 0), 0));
  const deliveryTotal   = r2(invoices.reduce((s, i) => s + (i.deliveryAmount   || 0), 0));
  const deductionTotal  = r2(invoices.reduce((s, i) => s + (i.supplierDeduction || 0), 0));
  const grandTotal      = r2(invoices.reduce((s, i) => s + (i.grandTotal       || 0), 0));
  const amountPaid      = r2(invoices.reduce((s, i) => s + (i.amountPaid       || 0), 0));

  const amountDue = isBuyer
    ? r2(invoices.filter(i => i.paymentStatus !== "cancelled")
                 .reduce((s, i) => s + (i.amountDue || 0), 0))
    : r2(grandTotal - deductionTotal - amountPaid);

  const status =
    amountDue <= 0 && grandTotal > 0 ? "paid"
    : amountPaid > 0                 ? "partial"
    :                                  "unpaid";

  const dueDate = new Date(new Date(`${dateKey}T00:00:00.000Z`).getTime() + (dueDays || 30) * DAY_MS);

  const payload = {
    billType, billDate: dateKey,
    billDateAt: new Date(`${dateKey}T00:00:00.000Z`),
    branchId, companyId: companyId || null,
    branchName: branchName || null, companyName: companyName || null,
    invoiceIds: invoices.map(i => i._id),
    itemCount:  invoices.length,
    subTotal, commissionTotal, deliveryTotal, deductionTotal, grandTotal,
    amountPaid, amountDue, status, dueDate,
  };

  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    return existing;
  }

  payload.billNumber = await nextBillNumber(billType, dateKey);
  try {
    return await BillInvoice.create(payload);
  } catch (err) {
    // Race: doosre process ne bana diya — usi ko wapas do
    if (err.code === 11000) {
      return BillInvoice.findOne({ billType, billDate: dateKey, branchId });
    }
    throw err;
  }
};

// ─────────────────────────────────────────────────────────
//  MAIN — ek din ke saare bills (buyer + supplier) generate karo
//
//  @returns { buyer: Map<branchIdStr, billNumber>, supplier: Map<...> }
//  Fail hone pe bhi khaali Maps return karti hai, throw nahi karti.
// ─────────────────────────────────────────────────────────
const generateDailyBills = async ({ dateKey = todayKey(), buyerDueDays = 30, supplierDueDays = 60 } = {}) => {
  const out = { buyer: new Map(), supplier: new Map(), created: 0 };

  try {
    const start = new Date(`${dateKey}T00:00:00.000Z`);
    const end   = new Date(start.getTime() + DAY_MS);

    const invoices = await Invoice.find({ createdAt: { $gte: start, $lt: end } })
      .populate("buyerBranchId",    "managerName companyName")
      .populate("supplierBranchId", "managerName companyName")
      .lean();

    if (invoices.length === 0) return out;

    // ─── Group ───────────────────────────────────────────
    const groups = { buyer: new Map(), supplier: new Map() };

    for (const inv of invoices) {
      const type = inv.invoiceType === "supplier" ? "supplier" : "buyer";
      const branch = type === "buyer" ? inv.buyerBranchId : inv.supplierBranchId;
      if (!branch?._id) continue;

      const key = String(branch._id);
      if (!groups[type].has(key)) {
        groups[type].set(key, {
          branchId:    branch._id,
          companyId:   type === "buyer" ? inv.buyerCompanyId : null,
          branchName:  branch.managerName,
          companyName: branch.companyName,
          invoices:    [],
        });
      }
      groups[type].get(key).invoices.push(inv);
    }

    // ─── Upsert + invoices pe bill stamp ─────────────────
    for (const type of ["buyer", "supplier"]) {
      const dueDays = type === "buyer" ? buyerDueDays : supplierDueDays;

      for (const [key, g] of groups[type]) {
        try {
          const bill = await upsertBill({ billType: type, dateKey, dueDays, ...g });
          if (!bill) continue;

          out[type].set(key, bill.billNumber);
          out.created += 1;

          await Invoice.updateMany(
            { _id: { $in: g.invoices.map(i => i._id) } },
            { billInvoiceId: bill._id, billNumber: bill.billNumber }
          );
        } catch (err) {
          console.error(`Bill upsert failed (${type}/${key}):`, err.message);
        }
      }
    }

    console.log(`🧾 Bills generated for ${dateKey} → buyer: ${out.buyer.size}, supplier: ${out.supplier.size}`);
  } catch (err) {
    console.error("generateDailyBills error:", err.message);
  }

  return out;
};

// ─────────────────────────────────────────────────────────
//  Bill ke totals invoices se dobara compute karo (payment ke baad)
// ─────────────────────────────────────────────────────────
const refreshBill = async (billId) => {
  try {
    const bill = await BillInvoice.findById(billId);
    if (!bill) return null;

    const invoices = await Invoice.find({ _id: { $in: bill.invoiceIds } }).lean();
    const isBuyer  = bill.billType === "buyer";

    bill.amountPaid = r2(invoices.reduce((s, i) => s + (i.amountPaid || 0), 0));
    bill.amountDue  = isBuyer
      ? r2(invoices.filter(i => i.paymentStatus !== "cancelled")
                   .reduce((s, i) => s + (i.amountDue || 0), 0))
      : r2(bill.grandTotal - bill.deductionTotal - bill.amountPaid);

    bill.status = bill.amountDue <= 0 && bill.grandTotal > 0 ? "paid"
                : bill.amountPaid > 0                        ? "partial"
                :                                              "unpaid";
    if (bill.status === "paid" && !bill.settledAt) bill.settledAt = new Date();

    await bill.save();
    return bill;
  } catch (err) {
    console.error("refreshBill error:", err.message);
    return null;
  }
};

module.exports = { generateDailyBills, refreshBill, nextBillNumber, todayKey };
