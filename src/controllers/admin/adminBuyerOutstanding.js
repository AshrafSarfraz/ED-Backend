// 📁 controllers/admin/adminBuyerOutstanding.js
// ═══════════════════════════════════════════════════════
//  BUYER OUTSTANDING — supplier flow ka exact mirror, 3 level
//    Level 1  /days                            → din wise (bill wise)
//    Level 2  /days/:date/buyers               → us din ke buyers
//    Level 3  /days/:date/buyers/:branchId     → ek buyer ki invoices + bill
//    Export   /export
//
//  Supplier side ledger-driven hai (humein DENA hai).
//  Buyer side Invoice-driven hai (humein LENA hai) — paymentStatus/amountDue se.
//
//  Purana /api/admin/buyer-payments bilkul waise ka waisa chal raha hai.
//  Ye naya router alag path pe mount hai: /api/admin/buyer-outstanding
// ═══════════════════════════════════════════════════════
const Invoice     = require("../../models/invoice");
const Branch      = require("../../models/Branch");
const Company     = require("../../models/createCompany");
const BillInvoice = require("../../models/BillInvoice");
const Payment     = require("../../models/Payment");
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

// Cancelled = return resolved supplier-guilty. Buyer ab ye paisa deta hi nahi.
const isLive = (inv) => inv.paymentStatus !== "cancelled";

const invoiceStatusLabel = (inv) => {
  if (inv.paymentStatus === "cancelled") return "Returned — Cancelled";
  if (inv.paymentStatus === "paid")      return "Paid";
  if (inv.paymentStatus === "partial")   return "Partially Paid";
  if (inv.dueDate && new Date(inv.dueDate) < new Date()) return "Overdue";
  return "Pending";
};

// ═══════════════════════════════════════════════════════
//  LEVEL 1 — GET /api/admin/buyer-outstanding/days
// ═══════════════════════════════════════════════════════
exports.getBuyerDays = async (req, res) => {
  try {
    const settings = await getCommissionSettings();
    const DUE_DAYS = settings.buyerPaymentDays || 30;

    const invoices = await Invoice.find({ invoiceType: "buyer" })
      .select("buyerBranchId grandTotal amountPaid amountDue paymentStatus dueDate createdAt billNumber")
      .lean();

    const dayMap = {};
    invoices.forEach(inv => {
      const dateKey = new Date(inv.createdAt).toISOString().slice(0, 10);
      if (!dayMap[dateKey]) {
        const deadline = new Date(new Date(dateKey).getTime() + DUE_DAYS * DAY_MS);
        dayMap[dateKey] = {
          date: dateKey,
          dateLabel: fmtDayLabel(dateKey),
          deadline: deadline.toISOString().slice(0, 10),
          daysLeft: Math.ceil((deadline.getTime() - Date.now()) / DAY_MS),
          totalBilled: 0, totalPaid: 0, totalDue: 0, totalCancelled: 0,
          invoiceCount: 0, buyerIds: new Set(),
        };
      }
      const d = dayMap[dateKey];
      d.buyerIds.add(String(inv.buyerBranchId));

      if (!isLive(inv)) {
        d.totalCancelled += inv.grandTotal || 0;
        return;
      }
      d.invoiceCount += 1;
      d.totalBilled  += inv.grandTotal || 0;
      d.totalPaid    += inv.amountPaid || 0;
      if (inv.paymentStatus !== "paid") d.totalDue += inv.amountDue || 0;
    });

    const data = Object.values(dayMap).map(d => {
      const totalDue = r2(d.totalDue);
      return {
        date: d.date, dateLabel: d.dateLabel,
        deadline: d.deadline, daysLeft: d.daysLeft,
        buyerCount:    d.buyerIds.size,
        invoiceCount:  d.invoiceCount,
        totalBilled:   r2(d.totalBilled),
        totalPaid:     r2(d.totalPaid),
        totalDue,
        totalCancelled: r2(d.totalCancelled),
        isOverdue:     d.daysLeft < 0 && totalDue > 0,
        isUrgent:      d.daysLeft >= 0 && d.daysLeft <= 7 && totalDue > 0,
        fullyPaid:     totalDue === 0,
      };
    }).sort((a, b) => b.date.localeCompare(a.date));

    const overall = {
      totalBilled:  r2(data.reduce((s, d) => s + d.totalBilled, 0)),
      totalPaid:    r2(data.reduce((s, d) => s + d.totalPaid,   0)),
      totalDue:     r2(data.reduce((s, d) => s + d.totalDue,    0)),
      overdueDays:  data.filter(d => d.isOverdue).length,
      urgentDays:   data.filter(d => d.isUrgent).length,
    };

    res.json({ success: true, overall, total: data.length, data });
  } catch (err) {
    console.error("getBuyerDays error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  LEVEL 2 — GET /api/admin/buyer-outstanding/days/:date/buyers
// ═══════════════════════════════════════════════════════
exports.getDayBuyers = async (req, res) => {
  try {
    const { date } = req.params;
    const settings = await getCommissionSettings();
    const DUE_DAYS = settings.buyerPaymentDays || 30;
    const { start, end } = dayRange(date);

    const deadline = new Date(new Date(date).getTime() + DUE_DAYS * DAY_MS);
    const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / DAY_MS);

    const invoices = await Invoice.find({
      invoiceType: "buyer",
      createdAt: { $gte: start, $lte: end },
    })
      .populate("platformItemId", "name")
      .select("buyerBranchId platformItemId grandTotal amountPaid amountDue paymentStatus billNumber refundAmount")
      .lean();

    const emptyPayload = {
      success: true, date, dateLabel: fmtDayLabel(date),
      dayTotal: {
        totalBilled: 0, totalPaid: 0, totalDue: 0, totalRefundDue: 0,
        buyerCount: 0, invoiceCount: 0,
        deadline: deadline.toISOString().slice(0, 10), daysLeft,
      },
      total: 0, data: [],
    };
    if (invoices.length === 0) return res.json(emptyPayload);

    const byBuyer = {};
    invoices.forEach(inv => {
      const key = String(inv.buyerBranchId);
      if (!byBuyer[key]) {
        byBuyer[key] = {
          branchId: key, itemNames: new Set(), invoiceCount: 0,
          totalBilled: 0, totalPaid: 0, totalDue: 0,
          cancelledAmount: 0, refundDue: 0,
          billNumber: inv.billNumber || null,
        };
      }
      const b = byBuyer[key];
      if (inv.platformItemId?.name) b.itemNames.add(inv.platformItemId.name);
      if (!b.billNumber && inv.billNumber) b.billNumber = inv.billNumber;
      b.refundDue += inv.refundAmount || 0;

      if (!isLive(inv)) { b.cancelledAmount += inv.grandTotal || 0; return; }

      b.invoiceCount += 1;
      b.totalBilled  += inv.grandTotal || 0;
      b.totalPaid    += inv.amountPaid || 0;
      if (inv.paymentStatus !== "paid") b.totalDue += inv.amountDue || 0;
    });

    const branchIds = Object.keys(byBuyer);
    const branches  = await Branch.find({ _id: { $in: branchIds } })
      .select("managerName companyName companyId email phone").lean();
    const branchMap = {}; branches.forEach(b => { branchMap[String(b._id)] = b; });

    const companyIds = [...new Set(branches.map(b => b.companyId).filter(Boolean).map(String))];
    const companies  = await Company.find({ _id: { $in: companyIds } })
      .select("businessType brandName").lean();
    const companyMap = {}; companies.forEach(c => { companyMap[String(c._id)] = c; });

    const bills = await BillInvoice.find({
      billType: "buyer", billDate: date, branchId: { $in: branchIds },
    }).select("branchId billNumber").lean();
    const billMap = {}; bills.forEach(b => { billMap[String(b.branchId)] = b.billNumber; });

    const data = Object.values(byBuyer).map(b => {
      const br = branchMap[b.branchId] || {};
      const c  = companyMap[String(br.companyId)] || {};
      const totalDue = r2(b.totalDue);
      return {
        branchId:     b.branchId,
        buyerName:    br.managerName || "—",
        companyName:  br.companyName || c.brandName || "—",
        businessType: c.businessType || "—",
        email:        br.email || null,
        phone:        br.phone || null,
        billNumber:   billMap[b.branchId] || b.billNumber || null,
        itemCount:    b.itemNames.size,
        invoiceCount: b.invoiceCount,
        totalBilled:  r2(b.totalBilled),
        totalPaid:    r2(b.totalPaid),
        totalDue,
        cancelledAmount: r2(b.cancelledAmount),
        refundDue:    r2(b.refundDue),
        status:       totalDue <= 0 ? "paid" : b.totalPaid > 0 ? "partial" : "pending",
      };
    }).sort((a, b) => b.totalDue - a.totalDue);

    res.json({
      success: true, date, dateLabel: fmtDayLabel(date),
      dayTotal: {
        totalBilled:    r2(data.reduce((s, d) => s + d.totalBilled, 0)),
        totalPaid:      r2(data.reduce((s, d) => s + d.totalPaid,   0)),
        totalDue:       r2(data.reduce((s, d) => s + d.totalDue,    0)),
        totalRefundDue: r2(data.reduce((s, d) => s + d.refundDue,   0)),
        buyerCount:     data.length,
        invoiceCount:   data.reduce((s, d) => s + d.invoiceCount, 0),
        deadline:       deadline.toISOString().slice(0, 10),
        daysLeft,
      },
      total: data.length, data,
    });
  } catch (err) {
    console.error("getDayBuyers error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  LEVEL 3 — GET /api/admin/buyer-outstanding/days/:date/buyers/:branchId
// ═══════════════════════════════════════════════════════
exports.getBuyerDayDetail = async (req, res) => {
  try {
    const { date, branchId } = req.params;
    const settings = await getCommissionSettings();
    const DUE_DAYS = settings.buyerPaymentDays || 30;
    const { start, end } = dayRange(date);

    const branch = await Branch.findById(branchId)
      .select("managerName companyName companyId email phone address").lean();
    if (!branch) return res.status(404).json({ success: false, message: "Buyer not found" });

    const company = branch.companyId
      ? await Company.findById(branch.companyId).select("businessType brandName tradeLicenseNumber").lean()
      : null;

    const deadline = new Date(new Date(date).getTime() + DUE_DAYS * DAY_MS);
    const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / DAY_MS);

    const [invoices, bill, receipts] = await Promise.all([
      Invoice.find({
        invoiceType: "buyer", buyerBranchId: branchId,
        createdAt: { $gte: start, $lte: end },
      })
        .populate("platformItemId",   "name unit image")
        .populate("countryId",        "name")
        .populate("supplierBranchId", "managerName companyName")
        .populate("bulkOrderId",      "_id")
        .sort({ invoiceNumber: 1 })
        .lean(),
      BillInvoice.findOne({ billType: "buyer", billDate: date, branchId })
        .select("billNumber grandTotal subTotal commissionTotal deliveryTotal amountPaid amountDue status dueDate").lean(),
      Payment.find({ buyerBranchId: branchId }).select("totalAmount status createdAt").lean().catch(() => []),
    ]);

    const buyerInfo = {
      branchId,
      buyerName:    branch.managerName,
      companyName:  branch.companyName || company?.brandName || "—",
      businessType: company?.businessType || "—",
      tradeLicense: company?.tradeLicenseNumber || null,
      email:        branch.email,
      phone:        branch.phone,
      address:      branch.address || null,
    };

    const rows = invoices.map(inv => ({
      invoiceId:     inv._id,
      invoiceNumber: inv.invoiceNumber,
      billNumber:    inv.billNumber || bill?.billNumber || null,
      item:          inv.platformItemId?.name || "—",
      image:         inv.platformItemId?.image || null,
      country:       inv.countryId?.name || "—",
      supplierName:  inv.supplierBranchId?.managerName || "—",
      supplierCompany: inv.supplierBranchId?.companyName || "—",
      quantity:      inv.quantity,
      unit:          inv.unit || inv.platformItemId?.unit || "",
      pricePerUnit:  r2(inv.pricePerUnit),
      subTotal:      r2(inv.totalAmount),
      commission:    r2(inv.commissionAmount),
      delivery:      r2(inv.deliveryAmount),
      grandTotal:    r2(inv.grandTotal),
      amountPaid:    r2(inv.amountPaid),
      amountDue:     inv.paymentStatus === "paid" ? 0 : r2(inv.amountDue),
      refundAmount:  r2(inv.refundAmount),
      paymentStatus: inv.paymentStatus,
      statusLabel:   invoiceStatusLabel(inv),
      isCancelled:   inv.paymentStatus === "cancelled",
      isOverdue:     !["paid", "cancelled"].includes(inv.paymentStatus) && inv.dueDate && new Date(inv.dueDate) < new Date(),
      deliveryStatus: inv.deliveryStatus,
      dueDate:       inv.dueDate,
      bulkOrderId:   inv.bulkOrderId?._id || null,
      orderRef:      inv.bulkOrderId?._id ? `#ORD-${String(inv.bulkOrderId._id).slice(-6).toUpperCase()}` : null,
      createdAt:     inv.createdAt,
    }));

    const live = rows.filter(r => !r.isCancelled);

    res.json({
      success: true, date, dateLabel: fmtDayLabel(date),
      buyer: buyerInfo,
      billNumber: bill?.billNumber || rows[0]?.billNumber || null,
      bill: bill || null,
      totals: {
        totalBilled:   r2(live.reduce((s, r) => s + r.grandTotal, 0)),
        subTotal:      r2(live.reduce((s, r) => s + r.subTotal,   0)),
        commission:    r2(live.reduce((s, r) => s + r.commission, 0)),
        delivery:      r2(live.reduce((s, r) => s + r.delivery,   0)),
        totalPaid:     r2(rows.reduce((s, r) => s + r.amountPaid, 0)),
        totalDue:      r2(live.reduce((s, r) => s + r.amountDue,  0)),
        refundDue:     r2(rows.reduce((s, r) => s + r.refundAmount, 0)),
        cancelledAmount: r2(rows.filter(r => r.isCancelled).reduce((s, r) => s + r.grandTotal, 0)),
        invoiceCount:  live.length,
        deadline:      deadline.toISOString().slice(0, 10),
        daysLeft,
      },
      receiptCount: Array.isArray(receipts) ? receipts.length : 0,
      total: rows.length, invoices: rows,
    });
  } catch (err) {
    console.error("getBuyerDayDetail error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  EXPORT — GET /api/admin/buyer-outstanding/export
//  ?onlyDue=true → sirf jo abhi bakaya hai
// ═══════════════════════════════════════════════════════
exports.exportBuyerOutstanding = async (req, res) => {
  try {
    const onlyDue  = String(req.query.onlyDue || "") === "true";
    const settings = await getCommissionSettings();
    const DUE_DAYS = settings.buyerPaymentDays || 30;

    const filter = { invoiceType: "buyer" };
    if (onlyDue) filter.paymentStatus = { $nin: ["paid", "cancelled"] };

    const invoices = await Invoice.find(filter)
      .populate("platformItemId",   "name unit")
      .populate("countryId",        "name")
      .populate("buyerBranchId",    "managerName companyName email phone")
      .populate("supplierBranchId", "managerName companyName")
      .sort({ createdAt: -1 })
      .lean();

    const data = invoices.map(inv => {
      const dateKey  = new Date(inv.createdAt).toISOString().slice(0, 10);
      const deadline = inv.dueDate
        ? new Date(inv.dueDate)
        : new Date(new Date(dateKey).getTime() + DUE_DAYS * DAY_MS);

      return {
        date:          dateKey,
        dateLabel:     fmtDayLabel(dateKey),
        billNumber:    inv.billNumber || "",
        invoiceNumber: inv.invoiceNumber,
        buyerName:     inv.buyerBranchId?.managerName || "—",
        buyerCompany:  inv.buyerBranchId?.companyName || "—",
        buyerEmail:    inv.buyerBranchId?.email || "",
        buyerPhone:    inv.buyerBranchId?.phone || "",
        supplierName:  inv.supplierBranchId?.managerName || "—",
        item:          inv.platformItemId?.name || "—",
        country:       inv.countryId?.name || "—",
        quantity:      inv.quantity,
        unit:          inv.unit || inv.platformItemId?.unit || "",
        pricePerUnit:  r2(inv.pricePerUnit),
        subTotal:      r2(inv.totalAmount),
        commission:    r2(inv.commissionAmount),
        delivery:      r2(inv.deliveryAmount),
        grandTotal:    r2(inv.grandTotal),
        amountPaid:    r2(inv.amountPaid),
        amountDue:     inv.paymentStatus === "paid" ? 0 : r2(inv.amountDue),
        refundAmount:  r2(inv.refundAmount),
        paymentStatus: invoiceStatusLabel(inv),
        deliveryStatus: inv.deliveryStatus || "",
        dueDate:       deadline.toISOString().slice(0, 10),
        daysLeft:      Math.ceil((deadline.getTime() - Date.now()) / DAY_MS),
      };
    });

    const live = data.filter(d => d.paymentStatus !== "Returned — Cancelled");

    res.json({
      success: true,
      total: data.length,
      totals: {
        totalBilled: r2(live.reduce((s, d) => s + d.grandTotal, 0)),
        totalPaid:   r2(data.reduce((s, d) => s + d.amountPaid, 0)),
        totalDue:    r2(live.reduce((s, d) => s + d.amountDue,  0)),
        refundDue:   r2(data.reduce((s, d) => s + d.refundAmount, 0)),
      },
      data,
    });
  } catch (err) {
    console.error("exportBuyerOutstanding error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
