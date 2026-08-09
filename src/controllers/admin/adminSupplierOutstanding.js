// 📁 controllers/admin/adminSupplierOutstanding.js
// ═══════════════════════════════════════════════════════
//  SUPPLIER OUTSTANDING — 3 level drill-down
//    Level 1  /days                              → adminSupplierPayment.getPaymentDays (pehle se hai)
//    Level 2  /days/:date/suppliers              → is file me
//    Level 3  /days/:date/suppliers/:branchId    → is file me
//    Export   /outstanding/export                → is file me
//
//  Purana `/days/:date/bulk-orders` waise ka waisa chal raha hai — kuch tuta nahi.
//  Money figures wahi ledger-driven logic use karte hain jo pehle se system me hai.
// ═══════════════════════════════════════════════════════
const Invoice     = require("../../models/invoice");
const Branch      = require("../../models/Branch");
const Company     = require("../../models/createCompany");
const LedgerEntry = require("../../models/ledger/LedgerEntry");
const ReturnOrder = require("../../models/returnOrder/ReturnOrder");
const BillInvoice = require("../../models/BillInvoice");
const { getCommissionSettings } = require("../../cron/commissionSettingService");

const DAY_MS = 24 * 60 * 60 * 1000;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const dayRange = (date) => {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end   = new Date(date); end.setHours(23, 59, 59, 999);
  return { start, end };
};

const fmtDayLabel = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

// ─────────────────────────────────────────────────────────
//  Buyer ki taraf se paisa aaya ya nahi (money IN) — supplier ko
//  release karne (money OUT) se ALAG cheez hai.
// ─────────────────────────────────────────────────────────
const buildBuyerPaymentResolver = async (buyerOrderIds) => {
  const [buyerInvoices, returnOrders] = await Promise.all([
    Invoice.find({ buyerOrderId: { $in: buyerOrderIds }, invoiceType: "buyer" })
      .select("buyerOrderId paymentStatus billNumber").lean(),
    ReturnOrder.find({ buyerOrderId: { $in: buyerOrderIds } })
      .select("buyerOrderId status").lean(),
  ]);

  const invMap = {}; buyerInvoices.forEach(b => { invMap[String(b.buyerOrderId)] = b; });
  const retMap = {}; returnOrders.forEach(r => { retMap[String(r.buyerOrderId)] = r; });

  return (buyerOrderId) => {
    const pending = { buyerPaymentStatus: "unpaid", buyerPaymentLabel: "Pending", buyerBillNumber: null };
    if (!buyerOrderId) return pending;

    const bi = invMap[String(buyerOrderId)];
    if (!bi) return pending;

    const buyerBillNumber = bi.billNumber || null;

    if (bi.paymentStatus === "paid") {
      return { buyerPaymentStatus: "paid", buyerPaymentLabel: "Paid", buyerBillNumber };
    }
    if (bi.paymentStatus === "cancelled") {
      const ro = retMap[String(buyerOrderId)];
      if (ro?.status === "resolved_rider_guilty") {
        return { buyerPaymentStatus: "paid_rider_recovery", buyerPaymentLabel: "Paid (Rider Recovery)", buyerBillNumber };
      }
      return { buyerPaymentStatus: "cancelled", buyerPaymentLabel: "Returned — No Payment", buyerBillNumber };
    }
    return { ...pending, buyerBillNumber };
  };
};

// ─────────────────────────────────────────────────────────
//  Ledger entries → per-invoice net (credit - debit) + settled flag
// ─────────────────────────────────────────────────────────
const aggregateByInvoice = (entries) => {
  const perInvoice = {};
  entries.forEach(e => {
    if (!e.invoiceId) return;
    const id = String(e.invoiceId);
    if (!perInvoice[id]) perInvoice[id] = { credit: 0, debit: 0, allSettled: true, hasPenalty: false };
    if (e.direction === "credit") perInvoice[id].credit += e.amount;
    else                          perInvoice[id].debit  += e.amount;
    if (!e.settled) perInvoice[id].allSettled = false;
    if (e.category === "return_penalty" || e.category === "order_earning_reversal") {
      perInvoice[id].hasPenalty = true;
    }
  });
  return perInvoice;
};

// ═══════════════════════════════════════════════════════
//  LEVEL 2 — GET /api/admin/supplier-payments/days/:date/suppliers
//  Us din ke suppliers ki list (screenshot: "Suppliers — 06 Aug 2026")
// ═══════════════════════════════════════════════════════
exports.getDaySuppliers = async (req, res) => {
  try {
    const { date } = req.params;
    const settings = await getCommissionSettings();
    const PAYMENT_DAYS = settings.supplierPaymentDays || 60;
    const { start, end } = dayRange(date);

    const entries = await LedgerEntry.find({
      entityType: "supplier",
      createdAt: { $gte: start, $lte: end },
    }).lean();

    const deadline = new Date(new Date(date).getTime() + PAYMENT_DAYS * DAY_MS);
    const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / DAY_MS);

    const emptyPayload = {
      success: true, date, dateLabel: fmtDayLabel(date),
      dayTotal: {
        totalEarned: 0, totalReleased: 0, totalPending: 0, totalDeduction: 0,
        supplierCount: 0, invoiceCount: 0,
        deadline: deadline.toISOString().slice(0, 10), daysLeft,
      },
      total: 0, data: [],
    };
    if (entries.length === 0) return res.json(emptyPayload);

    const perInvoice  = aggregateByInvoice(entries);
    const invoiceIds  = Object.keys(perInvoice);

    const invoices = await Invoice.find({ _id: { $in: invoiceIds } })
      .populate("platformItemId", "name")
      .select("supplierBranchId platformItemId invoiceNumber billNumber")
      .lean();
    const invMap = {}; invoices.forEach(i => { invMap[String(i._id)] = i; });

    // ─── Group per supplier branch ───────────────────────
    const bySupplier = {};
    Object.entries(perInvoice).forEach(([invId, agg]) => {
      const inv = invMap[invId];
      if (!inv?.supplierBranchId) return;
      const key = String(inv.supplierBranchId);

      if (!bySupplier[key]) {
        bySupplier[key] = {
          branchId: key,
          itemNames: new Set(), invoiceCount: 0,
          netEarned: 0, deductions: 0, released: 0, pending: 0,
          billNumber: inv.billNumber || null,
        };
      }
      const s = bySupplier[key];
      if (inv.platformItemId?.name) s.itemNames.add(inv.platformItemId.name);
      if (!s.billNumber && inv.billNumber) s.billNumber = inv.billNumber;
      s.invoiceCount += 1;

      const net = agg.credit - agg.debit;
      s.netEarned  += net;
      s.deductions += agg.debit;
      if (agg.allSettled) s.released += net;
      else                s.pending  += net;
    });

    // ─── Branch + company info ───────────────────────────
    const branchIds = Object.keys(bySupplier);
    const branches  = await Branch.find({ _id: { $in: branchIds } })
      .select("managerName companyName companyId email phone bankDetails").lean();
    const branchMap = {}; branches.forEach(b => { branchMap[String(b._id)] = b; });

    const companyIds = [...new Set(branches.map(b => b.companyId).filter(Boolean).map(String))];
    const companies  = await Company.find({ _id: { $in: companyIds } })
      .select("businessType brandName").lean();
    const companyMap = {}; companies.forEach(c => { companyMap[String(c._id)] = c; });

    // ─── Supplier bill numbers (BILL-S-…) ────────────────
    const bills = await BillInvoice.find({
      billType: "supplier", billDate: date, branchId: { $in: branchIds },
    }).select("branchId billNumber").lean();
    const billMap = {}; bills.forEach(b => { billMap[String(b.branchId)] = b.billNumber; });

    const data = Object.values(bySupplier).map(s => {
      const b = branchMap[s.branchId] || {};
      const c = companyMap[String(b.companyId)] || {};
      const pending = r2(s.pending);
      return {
        branchId:     s.branchId,
        supplierName: b.managerName || "—",
        companyName:  b.companyName || c.brandName || "—",
        businessType: c.businessType || "—",
        email:        b.email || null,
        phone:        b.phone || null,
        bankDetails:  b.bankDetails || null,
        billNumber:   billMap[s.branchId] || s.billNumber || null,
        itemCount:    s.itemNames.size,
        invoiceCount: s.invoiceCount,
        netEarned:    r2(s.netEarned),
        deductions:   r2(s.deductions),
        released:     r2(s.released),
        pending,
        status:       pending <= 0 ? "released" : "pending",
      };
    }).sort((a, b) => b.pending - a.pending);

    res.json({
      success: true, date, dateLabel: fmtDayLabel(date),
      dayTotal: {
        totalEarned:    r2(data.reduce((s, d) => s + d.netEarned,  0)),
        totalReleased:  r2(data.reduce((s, d) => s + d.released,   0)),
        totalPending:   r2(data.reduce((s, d) => s + d.pending,    0)),
        totalDeduction: r2(data.reduce((s, d) => s + d.deductions, 0)),
        supplierCount:  data.length,
        invoiceCount:   data.reduce((s, d) => s + d.invoiceCount, 0),
        deadline:       deadline.toISOString().slice(0, 10),
        daysLeft,
      },
      total: data.length, data,
    });
  } catch (err) {
    console.error("getDaySuppliers error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  LEVEL 3 — GET /api/admin/supplier-payments/days/:date/suppliers/:branchId
//  Ek supplier ki us din ki saari invoices + bank + payment advice number
// ═══════════════════════════════════════════════════════
exports.getSupplierDayDetail = async (req, res) => {
  try {
    const { date, branchId } = req.params;
    const settings = await getCommissionSettings();
    const PAYMENT_DAYS = settings.supplierPaymentDays || 60;
    const { start, end } = dayRange(date);

    const branch = await Branch.findById(branchId)
      .select("managerName companyName companyId email phone bankDetails address").lean();
    if (!branch) return res.status(404).json({ success: false, message: "Supplier not found" });

    const company = branch.companyId
      ? await Company.findById(branch.companyId).select("businessType brandName").lean()
      : null;

    const entries = await LedgerEntry.find({
      entityType: "supplier",
      entityId:   branchId,
      createdAt:  { $gte: start, $lte: end },
    }).lean();

    const deadline = new Date(new Date(date).getTime() + PAYMENT_DAYS * DAY_MS);
    const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / DAY_MS);

    const bill = await BillInvoice.findOne({ billType: "supplier", billDate: date, branchId })
      .select("billNumber grandTotal deductionTotal amountDue status dueDate").lean();

    const supplierInfo = {
      branchId,
      supplierName: branch.managerName,
      companyName:  branch.companyName || company?.brandName || "—",
      businessType: company?.businessType || "—",
      email:        branch.email,
      phone:        branch.phone,
      address:      branch.address || null,
      bankDetails:  branch.bankDetails || null,
    };

    if (entries.length === 0) {
      return res.json({
        success: true, date, dateLabel: fmtDayLabel(date),
        supplier: supplierInfo,
        billNumber: bill?.billNumber || null,
        totals: { netEarned: 0, deductions: 0, released: 0, pending: 0, invoiceCount: 0, deadline: deadline.toISOString().slice(0, 10), daysLeft },
        total: 0, invoices: [],
      });
    }

    const perInvoice = aggregateByInvoice(entries);
    const invoiceIds = Object.keys(perInvoice);

    const invoices = await Invoice.find({ _id: { $in: invoiceIds } })
      .populate("platformItemId", "name unit image")
      .populate("countryId",      "name")
      .populate("buyerBranchId",  "managerName companyName")
      .populate("bulkOrderId",    "_id winningPrice")
      .lean();
    const invMap = {}; invoices.forEach(i => { invMap[String(i._id)] = i; });

    const buyerOrderIds = [...new Set(invoices.filter(i => i.buyerOrderId).map(i => String(i.buyerOrderId)))];
    const resolveBuyerPayment = await buildBuyerPaymentResolver(buyerOrderIds);

    const rows = Object.entries(perInvoice).map(([invId, agg]) => {
      const inv = invMap[invId];
      if (!inv) return null;

      const net       = r2(agg.credit - agg.debit);
      const deduction = r2(agg.debit);
      const isReturned = agg.hasPenalty;
      const bp = resolveBuyerPayment(inv.buyerOrderId);

      return {
        invoiceId:     inv._id,
        invoiceNumber: inv.invoiceNumber,
        billNumber:    inv.billNumber || bill?.billNumber || null,
        item:          inv.platformItemId?.name || "—",
        image:         inv.platformItemId?.image || null,
        country:       inv.countryId?.name || "—",
        buyerName:     inv.buyerBranchId?.managerName || "—",
        buyerCompany:  inv.buyerBranchId?.companyName || "—",
        buyerBillNumber: bp.buyerBillNumber,
        quantity:      inv.quantity,
        unit:          inv.unit || inv.platformItemId?.unit || "",
        pricePerUnit:  r2(inv.pricePerUnit),
        amount:        isReturned ? 0 : r2(inv.grandTotal),
        deduction,
        netAmount:     net,
        isReturned,
        bulkOrderId:   inv.bulkOrderId?._id || null,
        orderRef:      inv.bulkOrderId?._id ? `#ORD-${String(inv.bulkOrderId._id).slice(-6).toUpperCase()}` : null,
        buyerPaymentStatus: bp.buyerPaymentStatus,
        buyerPaymentLabel:  bp.buyerPaymentLabel,
        releaseStatus: agg.allSettled ? "released" : "pending",
        paidAt:        inv.supplierPaidAt || null,
        createdAt:     inv.createdAt,
      };
    }).filter(Boolean).sort((a, b) => String(a.invoiceNumber).localeCompare(String(b.invoiceNumber)));

    const released = r2(rows.filter(r => r.releaseStatus === "released").reduce((s, r) => s + r.netAmount, 0));
    const pending  = r2(rows.filter(r => r.releaseStatus !== "released").reduce((s, r) => s + r.netAmount, 0));

    res.json({
      success: true, date, dateLabel: fmtDayLabel(date),
      supplier: supplierInfo,
      billNumber: bill?.billNumber || rows[0]?.billNumber || null,
      bill: bill || null,
      totals: {
        netEarned:    r2(rows.reduce((s, r) => s + r.netAmount, 0)),
        deductions:   r2(rows.reduce((s, r) => s + r.deduction, 0)),
        released, pending,
        invoiceCount: rows.length,
        deadline: deadline.toISOString().slice(0, 10),
        daysLeft,
      },
      total: rows.length, invoices: rows,
    });
  } catch (err) {
    console.error("getSupplierDayDetail error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  EXPORT — GET /api/admin/supplier-payments/outstanding/export
//  Flat rows — frontend inhe seedha Excel me daal deta hai.
//  ?onlyPending=true  → sirf jo abhi bakaya hai
// ═══════════════════════════════════════════════════════
exports.exportSupplierOutstanding = async (req, res) => {
  try {
    const onlyPending = String(req.query.onlyPending || "") === "true";
    const settings = await getCommissionSettings();
    const PAYMENT_DAYS = settings.supplierPaymentDays || 60;

    const filter = { entityType: "supplier" };
    if (onlyPending) filter.settled = false;

    const entries = await LedgerEntry.find(filter).lean();
    if (entries.length === 0) {
      return res.json({ success: true, total: 0, totals: {}, data: [] });
    }

    const perInvoice = aggregateByInvoice(entries);
    const invoiceIds = Object.keys(perInvoice);

    const invoices = await Invoice.find({ _id: { $in: invoiceIds } })
      .populate("platformItemId",   "name unit")
      .populate("countryId",        "name")
      .populate("buyerBranchId",    "managerName companyName")
      .populate("supplierBranchId", "managerName companyName bankDetails")
      .lean();
    const invMap = {}; invoices.forEach(i => { invMap[String(i._id)] = i; });

    const buyerOrderIds = [...new Set(invoices.filter(i => i.buyerOrderId).map(i => String(i.buyerOrderId)))];
    const resolveBuyerPayment = await buildBuyerPaymentResolver(buyerOrderIds);

    const data = Object.entries(perInvoice).map(([invId, agg]) => {
      const inv = invMap[invId];
      if (!inv) return null;

      const dateKey  = new Date(inv.createdAt).toISOString().slice(0, 10);
      const deadline = new Date(new Date(dateKey).getTime() + PAYMENT_DAYS * DAY_MS);
      const bp = resolveBuyerPayment(inv.buyerOrderId);
      const bank = inv.supplierBranchId?.bankDetails || {};

      return {
        date:          dateKey,
        dateLabel:     fmtDayLabel(dateKey),
        billNumber:    inv.billNumber || "",
        invoiceNumber: inv.invoiceNumber,
        supplierName:  inv.supplierBranchId?.managerName || "—",
        supplierCompany: inv.supplierBranchId?.companyName || "—",
        item:          inv.platformItemId?.name || "—",
        country:       inv.countryId?.name || "—",
        buyerName:     inv.buyerBranchId?.managerName || "—",
        buyerCompany:  inv.buyerBranchId?.companyName || "—",
        quantity:      inv.quantity,
        unit:          inv.unit || inv.platformItemId?.unit || "",
        pricePerUnit:  r2(inv.pricePerUnit),
        amount:        r2(inv.grandTotal),
        deduction:     r2(agg.debit),
        netAmount:     r2(agg.credit - agg.debit),
        released:      agg.allSettled ? r2(agg.credit - agg.debit) : 0,
        pending:       agg.allSettled ? 0 : r2(agg.credit - agg.debit),
        releaseStatus: agg.allSettled ? "Released" : "Pending",
        buyerPayment:  bp.buyerPaymentLabel,
        deadline:      deadline.toISOString().slice(0, 10),
        daysLeft:      Math.ceil((deadline.getTime() - Date.now()) / DAY_MS),
        bankName:      bank.bankName || "",
        accountName:   bank.accountName || "",
        accountNumber: bank.accountNumber || "",
        iban:          bank.iban || "",
        swiftCode:     bank.swiftCode || "",
      };
    }).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));

    res.json({
      success: true,
      total: data.length,
      totals: {
        netAmount: r2(data.reduce((s, d) => s + d.netAmount, 0)),
        released:  r2(data.reduce((s, d) => s + d.released,  0)),
        pending:   r2(data.reduce((s, d) => s + d.pending,   0)),
        deduction: r2(data.reduce((s, d) => s + d.deduction, 0)),
      },
      data,
    });
  } catch (err) {
    console.error("exportSupplierOutstanding error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
