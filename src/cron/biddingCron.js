// // 📁 cron/biddingCron.js
// const cron = require("node-cron");
// const BuyerOrder   = require("../models/buyer/buyerOrder");
// const BulkOrder    = require("../models/BulkOrder");
// const Bid          = require("../models/Bid");
// const PlatformItem = require("../models/masterData/PlatformItem");
// const Country      = require("../models/masterData/Country");
// const Invoice      = require("../models/invoice");
// const SupplierItem = require("../models/supplier/supplierCatalog");
// const Branch       = require("../models/Branch");
// const { getBiddingSettings } = require("./settingService");
// const { getCommissionSettings } = require("./commissionSettingService");
// const ledger = require("../services/ledgerService");
// const {
//   sendOrderCancelledEmail,
//   sendOrderWonEmail,
// } = require("../utils/sendEmail");

// let biddingStartJob = null;
// let winnerJob       = null;

// // ─────────────────────────────────────────────────────────
// //  Qatar time helpers (Qatar = UTC+3, no DST)
// // ─────────────────────────────────────────────────────────
// const getQatarNowParts = () => {
//   const qatar = new Date(Date.now() + 3 * 60 * 60 * 1000);
//   return {
//     year:  qatar.getUTCFullYear(),
//     month: qatar.getUTCMonth(),
//     day:   qatar.getUTCDate(),
//   };
// };

// const buildQatarTimeToday = (hour, min) => {
//   const { year, month, day } = getQatarNowParts();
//   const utcMs = Date.UTC(year, month, day, hour, min, 0, 0) - 3 * 60 * 60 * 1000;
//   return new Date(utcMs);
// };

// const buildQatarTimeTomorrow = (hour, min) => {
//   const { year, month, day } = getQatarNowParts();
//   const utcMs = Date.UTC(year, month, day + 1, hour, min, 0, 0) - 3 * 60 * 60 * 1000;
//   return new Date(utcMs);
// };

// const getQatarDayRange = () => {
//   const { year, month, day } = getQatarNowParts();
//   const start = new Date(Date.UTC(year, month, day,     0, 0, 0, 0) - 3 * 60 * 60 * 1000);
//   const end   = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0) - 3 * 60 * 60 * 1000);
//   return { start, end };
// };

// const buildStartAt = (settings) =>
//   buildQatarTimeToday(settings.BIDDING_START_HOUR, settings.BIDDING_START_MIN);

// const buildEndAt = (settings) =>
//   buildQatarTimeToday(settings.WINNER_HOUR, settings.WINNER_MIN);

// // ─────────────────────────────────────────────────────────
// //  Invoice number generator — LOCKED (race condition safe)
// //  Buyer aur Supplier dono ko SAME number milta hai
// //  e.g. INV-B-20260626-0011 aur INV-S-20260626-0011
// // ─────────────────────────────────────────────────────────
// //  counter — in-memory, cron ke ek run mein consistent rahega
// let _invoiceCounter = null;

// const initInvoiceCounter = async () => {
//   // Sab se bada existing number nikalo
//   const last = await Invoice.findOne().sort({ createdAt: -1 }).select("invoiceNumber");
//   if (last?.invoiceNumber) {
//     // INV-B-20260626-0023 → 23
//     const parts = last.invoiceNumber.split("-");
//     const num   = parseInt(parts[parts.length - 1], 10);
//     _invoiceCounter = isNaN(num) ? 0 : num;
//   } else {
//     _invoiceCounter = 0;
//   }
// };

// const nextInvNum = () => {
//   _invoiceCounter += 1;
//   return String(_invoiceCounter).padStart(4, "0");
// };

// // ─────────────────────────────────────────────────────────
// //  Missed bids record karo
// // ─────────────────────────────────────────────────────────
// const recordMissedBids = async (bulkOrder) => {
//   const eligible = await SupplierItem.find({
//     platformItemId: bulkOrder.platformItemId,
//     countryId:      bulkOrder.countryId,
//     isListed:       true,
//   });

//   const seen = new Set();
//   for (const si of eligible) {
//     const sid = si.branchId.toString();
//     if (seen.has(sid)) continue;
//     seen.add(sid);

//     const existing = await Bid.findOne({
//       bulkOrderId:      bulkOrder._id,
//       supplierBranchId: si.branchId,
//     });
//     if (existing) continue;

//     const branch = await Branch.findById(si.branchId).select("companyId");
//     if (!branch) continue;

//     try {
//       await Bid.create({
//         bulkOrderId:       bulkOrder._id,
//         supplierBranchId:  si.branchId,
//         supplierCompanyId: branch.companyId,
//         pricePerUnit:      null,
//         status:            "missed",
//       });
//     } catch (e) {}
//   }
// };

// // ═══════════════════════════════════════════════
// // 1) Bidding Start
// // ═══════════════════════════════════════════════
// const runBiddingStart = async (settings) => {
//   console.log("⏰ Bidding Start Cron...");
//   try {
//     const { start: dayStart, end: dayEnd } = getQatarDayRange();

//     const pendingOrders = await BuyerOrder.find({
//       status:  "pending",
//       bidDate: { $gte: dayStart, $lt: dayEnd },
//     });

//     if (pendingOrders.length === 0) {
//       console.log("❌ Koi pending order nahi");
//       return;
//     }
//     console.log(`📦 ${pendingOrders.length} pending orders mile`);

//     const groups = {};
//     for (const order of pendingOrders) {
//       const key = `${order.platformItemId}_${order.countryId}`;
//       if (!groups[key]) {
//         const supplierItems = await SupplierItem.find({
//           platformItemId:   order.platformItemId,
//           countryId:        order.countryId,
//           isListed:         true,
//           isAvailableToday: true,
//         });
//         const prices   = supplierItems.map((s) => s.pricePerUnit);
//         const minPrice = prices.length > 0 ? Math.min(...prices) : null;
//         const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

//         groups[key] = {
//           platformItemId: order.platformItemId,
//           countryId:      order.countryId,
//           totalQuantity:  0,
//           buyerOrderIds:  [],
//           minPrice,
//           maxPrice,
//         };
//       }
//       groups[key].totalQuantity += order.quantity;
//       groups[key].buyerOrderIds.push(order._id);
//     }

//     const biddingStartsAt = buildStartAt(settings);
//     const biddingEndsAt   = buildEndAt(settings);

//     console.log(`🕒 Start: ${biddingStartsAt.toISOString()} | End: ${biddingEndsAt.toISOString()}`);

//     for (const key of Object.keys(groups)) {
//       const g = groups[key];

//       const existingBulk = await BulkOrder.findOne({
//         platformItemId: g.platformItemId,
//         countryId:      g.countryId,
//         status:         "bidding",
//       });

//       if (existingBulk) {
//         const newOrderIds = g.buyerOrderIds.filter(
//           (id) => !existingBulk.buyerOrderIds.map(String).includes(String(id))
//         );
//         if (newOrderIds.length > 0) {
//           await BulkOrder.findByIdAndUpdate(existingBulk._id, {
//             $inc:  { totalQuantity: g.totalQuantity },
//             $push: { buyerOrderIds: { $each: newOrderIds } },
//             bidDate:       biddingStartsAt,
//             biddingEndsAt,
//             minPrice:      g.minPrice,
//             maxPrice:      g.maxPrice,
//           });
//           await BuyerOrder.updateMany(
//             { _id: { $in: newOrderIds } },
//             { status: "in_bidding", bulkOrderId: existingBulk._id }
//           );
//         } else {
//           await BuyerOrder.updateMany(
//             { _id: { $in: g.buyerOrderIds } },
//             { status: "in_bidding" }
//           );
//         }
//         console.log(`♻️ BulkOrder updated: ${existingBulk._id}`);
//       } else {
//         const bulkOrder = await BulkOrder.create({
//           platformItemId: g.platformItemId,
//           countryId:      g.countryId,
//           totalQuantity:  g.totalQuantity,
//           buyerOrderIds:  g.buyerOrderIds,
//           bidDate:        biddingStartsAt,
//           biddingEndsAt,
//           retryCount:     1,
//           minPrice:       g.minPrice,
//           maxPrice:       g.maxPrice,
//         });
//         await BuyerOrder.updateMany(
//           { _id: { $in: g.buyerOrderIds } },
//           { status: "in_bidding", bulkOrderId: bulkOrder._id }
//         );
//         console.log(`✅ BulkOrder: ${bulkOrder._id}`);
//       }
//     }
//   } catch (err) {
//     console.error("Bidding Start error:", err);
//   }
// };

// // ═══════════════════════════════════════════════
// // 2) Winner Select
// // ═══════════════════════════════════════════════
// const runWinnerSelect = async (settings) => {
//   console.log("⏰ Winner Select Cron...");
//   try {
//     // ─── Counter initialize karo — ek baar sab buyer orders ke liye ───
//     await initInvoiceCounter();

//     // ─── Commission settings DB se fetch karo ────────
//     const commSettings = await getCommissionSettings();
//     const COMMISSION_PCT = commSettings.platformCommission / 100;  // e.g. 0.02
//     const DELIVERY_PCT   = commSettings.deliveryFee         / 100;  // e.g. 0.01
//     const BUYER_DUE_DAYS = commSettings.buyerPaymentDays;           // e.g. 30

//     const activeBulkOrders = await BulkOrder.find({ status: "bidding" });
//     if (activeBulkOrders.length === 0) {
//       console.log("❌ Koi active bulk order nahi");
//       return;
//     }

//     for (const bulkOrder of activeBulkOrders) {
//       const platformItem = await PlatformItem.findById(bulkOrder.platformItemId);
//       const country      = await Country.findById(bulkOrder.countryId);
//       const winningBid   = await Bid.findOne({
//         bulkOrderId:  bulkOrder._id,
//         pricePerUnit: { $ne: null },
//       }).sort({ pricePerUnit: 1 });

//       // ─── No bid → CANCEL ───────────────────────────────
//       if (!winningBid) {
//         await BulkOrder.findByIdAndUpdate(bulkOrder._id, { status: "cancelled" });

//         const buyerOrders = await BuyerOrder.find({
//           _id: { $in: bulkOrder.buyerOrderIds },
//         }).populate("buyerBranchId");

//         for (const bo of buyerOrders) {
//           await BuyerOrder.findByIdAndUpdate(bo._id, {
//             status: "cancelled", estimatedAmount: 0,
//           });
//           await sendOrderCancelledEmail({
//             toEmail:     bo.buyerBranchId.email,
//             managerName: bo.buyerBranchId.managerName,
//             itemName:    platformItem?.name,
//             country:     country?.name,
//           });
//         }

//         await recordMissedBids(bulkOrder);
//         console.log(`❌ No supplier — cancelled: ${bulkOrder._id}`);
//         continue;
//       }

//       // ─── Winner found ──────────────────────────────────
//       await BulkOrder.findByIdAndUpdate(bulkOrder._id, {
//         status:           "awarded",
//         winnerSupplierId: winningBid.supplierBranchId,
//         winningPrice:     winningBid.pricePerUnit,
//       });

//       await Bid.findByIdAndUpdate(winningBid._id, { status: "won" });
//       await Bid.updateMany(
//         {
//           bulkOrderId:  bulkOrder._id,
//           _id:          { $ne: winningBid._id },
//           pricePerUnit: { $ne: null },
//         },
//         { status: "lost" }
//       );

//       await recordMissedBids(bulkOrder);

//       const supplierBranch = await Branch.findById(winningBid.supplierBranchId);
//       const packingDays    = supplierBranch?.defaultPackingDays || 2;

//       const buyerOrders = await BuyerOrder.find({
//         _id: { $in: bulkOrder.buyerOrderIds },
//       }).populate("buyerBranchId");

//       const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

//       for (const bo of buyerOrders) {
//         const rawTotal         = bo.quantity * winningBid.pricePerUnit;
//         const commissionAmount = Math.round(rawTotal * COMMISSION_PCT * 100) / 100;
//         const deliveryAmount   = Math.round(rawTotal * DELIVERY_PCT   * 100) / 100;
//         const totalFeeAmount   = commissionAmount + deliveryAmount;
//         const buyerGrandTotal  = Math.round((rawTotal + totalFeeAmount) * 100) / 100;

//         const dueDate = new Date();
//         dueDate.setDate(dueDate.getDate() + BUYER_DUE_DAYS);

//         // ─── LOCKED invoice number — same for buyer & supplier ───
//         const invNum         = nextInvNum();  // ← atomic increment, no DB call
//         const buyerInvNum    = `INV-B-${dateStr}-${invNum}`;
//         const supplierInvNum = `INV-S-${dateStr}-${invNum}`;

//         // ─── Buyer invoice ────────────────────────────────
//         const buyerInvoiceDoc = await Invoice.create({
//           buyerOrderId:     bo._id,
//           bulkOrderId:      bulkOrder._id,
//           buyerBranchId:    bo.buyerBranchId._id,
//           buyerCompanyId:   bo.buyerCompanyId,
//           supplierBranchId: winningBid.supplierBranchId,
//           platformItemId:   bulkOrder.platformItemId,
//           countryId:        bulkOrder.countryId,
//           invoiceNumber:    buyerInvNum,
//           invoiceType:      "buyer",
//           invoiceStatus:    "final",
//           quantity:         bo.quantity,
//           unit:             platformItem?.unit,
//           pricePerUnit:     winningBid.pricePerUnit,
//           totalAmount:      rawTotal,
//           commissionAmount,
//           deliveryAmount,
//           totalFeeAmount,
//           grandTotal:       buyerGrandTotal,
//           deliveryCharge:   0,
//           amountDue:        buyerGrandTotal,
//           dueDate,
//         });

//         // ─── Supplier invoice — SAME invNum ───────────────
//         const supplierInvoiceDoc = await Invoice.create({
//           buyerOrderId:     bo._id,
//           bulkOrderId:      bulkOrder._id,
//           buyerBranchId:    bo.buyerBranchId._id,
//           buyerCompanyId:   bo.buyerCompanyId,
//           supplierBranchId: winningBid.supplierBranchId,
//           platformItemId:   bulkOrder.platformItemId,
//           countryId:        bulkOrder.countryId,
//           invoiceNumber:    supplierInvNum,
//           invoiceType:      "supplier",
//           invoiceStatus:    "final",
//           quantity:         bo.quantity,
//           unit:             platformItem?.unit,
//           pricePerUnit:     winningBid.pricePerUnit,
//           totalAmount:      rawTotal,
//           commissionAmount: 0,
//           deliveryAmount:   0,
//           totalFeeAmount:   0,
//           grandTotal:       rawTotal,
//           deliveryCharge:   0,
//           amountDue:        rawTotal,
//           dueDate,
//           supplierPaymentStatus: "pending",
//         });

//         // ─── Ledger — supplier earns the full order amount, platform earns its 2% ───
//         // (rider's 1% is credited separately at actual delivery time — see riderDelivery.js)
//         try {
//           await ledger.creditSupplier(
//             winningBid.supplierBranchId, rawTotal, "order_earning",
//             { invoiceId: supplierInvoiceDoc._id, bulkOrderId: bulkOrder._id, buyerOrderId: bo._id },
//             `Order earning — ${supplierInvNum}`
//           );
//           await ledger.creditPlatform(
//             commissionAmount, "commission",
//             { invoiceId: buyerInvoiceDoc._id, bulkOrderId: bulkOrder._id, buyerOrderId: bo._id },
//             `Platform commission — ${buyerInvNum}`
//           );
//         } catch (ledgerErr) {
//           console.error("Ledger entry error (order won):", ledgerErr);
//         }

//         await sendOrderWonEmail({
//           toEmail:      bo.buyerBranchId.email,
//           managerName:  bo.buyerBranchId.managerName,
//           itemName:     platformItem?.name,
//           country:      country?.name,
//           quantity:     bo.quantity,
//           unit:         platformItem?.unit,
//           pricePerUnit: Math.round(winningBid.pricePerUnit * 1.03 * 100) / 100,
//           totalAmount:  buyerGrandTotal,
//           packingDays,
//         });

//         await BuyerOrder.findByIdAndUpdate(bo._id, {
//           status:          "won",
//           estimatedAmount: 0,
//         });

//         console.log(`🧾 Buyer: ${buyerInvNum} | Supplier: ${supplierInvNum}`);
//       }

//       console.log(`✅ Winner: ${winningBid.pricePerUnit} QAR`);
//     }
//   } catch (err) {
//     console.error("Winner Cron error:", err);
//   }
// };

// // ═══════════════════════════════════════════════
// // 3) Schedule / Reschedule
// // ═══════════════════════════════════════════════
// const scheduleCrons = async () => {
//   const s = await getBiddingSettings();

//   if (biddingStartJob) biddingStartJob.stop();
//   if (winnerJob)       winnerJob.stop();

//   const startExpr  = `${s.BIDDING_START_MIN} ${s.BIDDING_START_HOUR} * * *`;
//   const winnerExpr = `${s.WINNER_MIN} ${s.WINNER_HOUR} * * *`;

//   biddingStartJob = cron.schedule(
//     startExpr,
//     async () => {
//       const latest = await getBiddingSettings();
//       await runBiddingStart(latest);
//     },
//     { timezone: "Asia/Qatar" }
//   );

//   winnerJob = cron.schedule(
//     winnerExpr,
//     async () => {
//       const latest = await getBiddingSettings();
//       await runWinnerSelect(latest);
//     },
//     { timezone: "Asia/Qatar" }
//   );

//   console.log(`🕒 Crons set → Start: ${startExpr} | Winner: ${winnerExpr} (Qatar)`);
// };

// module.exports = {
//   scheduleCrons,
//   runBiddingStart,
//   runWinnerSelect,
// };


// 📁 cron/biddingCron.js
const cron = require("node-cron");
const BuyerOrder   = require("../models/buyer/buyerOrder");
const BulkOrder    = require("../models/BulkOrder");
const Bid          = require("../models/Bid");
const PlatformItem = require("../models/masterData/PlatformItem");
const Country      = require("../models/masterData/Country");
const Invoice      = require("../models/invoice");
const SupplierItem = require("../models/supplier/supplierCatalog");
const Branch       = require("../models/Branch");
const { getBiddingSettings } = require("./settingService");
const { getCommissionSettings } = require("./commissionSettingService");
const ledger = require("../services/ledgerService");
const { generateDailyBills } = require("../services/billService");
const {
  sendOrdersWonSummaryEmail,
  sendOrdersCancelledSummaryEmail,
} = require("../utils/sendEmail");
const {
  notifyBiddingResult,
  notifyBiddingStarted,
  getTokensForBranches,
} = require("../notification/notificationService");

let biddingStartJob = null;
let winnerJob       = null;

// ─────────────────────────────────────────────────────────
//  Qatar time helpers (Qatar = UTC+3, no DST)
// ─────────────────────────────────────────────────────────
const getQatarNowParts = () => {
  const qatar = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return {
    year:  qatar.getUTCFullYear(),
    month: qatar.getUTCMonth(),
    day:   qatar.getUTCDate(),
  };
};

const buildQatarTimeToday = (hour, min) => {
  const { year, month, day } = getQatarNowParts();
  const utcMs = Date.UTC(year, month, day, hour, min, 0, 0) - 3 * 60 * 60 * 1000;
  return new Date(utcMs);
};

const buildQatarTimeTomorrow = (hour, min) => {
  const { year, month, day } = getQatarNowParts();
  const utcMs = Date.UTC(year, month, day + 1, hour, min, 0, 0) - 3 * 60 * 60 * 1000;
  return new Date(utcMs);
};

const getQatarDayRange = () => {
  const { year, month, day } = getQatarNowParts();
  const start = new Date(Date.UTC(year, month, day,     0, 0, 0, 0) - 3 * 60 * 60 * 1000);
  const end   = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0) - 3 * 60 * 60 * 1000);
  return { start, end };
};

const buildStartAt = (settings) =>
  buildQatarTimeToday(settings.BIDDING_START_HOUR, settings.BIDDING_START_MIN);

const buildEndAt = (settings) =>
  buildQatarTimeToday(settings.WINNER_HOUR, settings.WINNER_MIN);

// ─────────────────────────────────────────────────────────
//  Invoice number generator — LOCKED (race condition safe)
//  Buyer aur Supplier dono ko SAME number milta hai
//  e.g. INV-B-20260626-0011 aur INV-S-20260626-0011
// ─────────────────────────────────────────────────────────
//  counter — in-memory, cron ke ek run mein consistent rahega
let _invoiceCounter = null;

const initInvoiceCounter = async () => {
  // Sab se bada existing number nikalo
  const last = await Invoice.findOne().sort({ createdAt: -1 }).select("invoiceNumber");
  if (last?.invoiceNumber) {
    // INV-B-20260626-0023 → 23
    const parts = last.invoiceNumber.split("-");
    const num   = parseInt(parts[parts.length - 1], 10);
    _invoiceCounter = isNaN(num) ? 0 : num;
  } else {
    _invoiceCounter = 0;
  }
};

const nextInvNum = () => {
  _invoiceCounter += 1;
  return String(_invoiceCounter).padStart(4, "0");
};

// ─────────────────────────────────────────────────────────
//  Buyer email digest — cron ke dauran har buyer branch ke won/cancelled
//  orders jama karte hain, aur cron ke END me sirf 2 email bhejte hain
//  (pehle har order pe alag email jaati thi — 10 orders = 10 emails)
// ─────────────────────────────────────────────────────────
const pushToDigest = (digest, branch, bucket, row) => {
  if (!branch?._id || !branch?.email) return;   // branch delete ho gaya ho to skip
  const key = String(branch._id);
  if (!digest.has(key)) {
    digest.set(key, {
      branchId:    branch._id,
      email:       branch.email,
      managerName: branch.managerName || "Customer",
      // populate() se aa jaate hain — push bhejne ke liye extra DB query nahi lagti
      fcmTokens:   branch.fcmTokens || [],
      won:         [],
      cancelled:   [],
    });
  }
  digest.get(key)[bucket].push(row);
};

//  billMap: Map<branchIdStr, billNumber> — won email me BILL-B-… dikhane ke liye.
//  Missing ho to email pehle jaisa hi jaata hai, sirf bill number nahi hoga.
const flushDigest = async (digest, billMap = new Map()) => {
  if (digest.size === 0) return;   // kuch process nahi hua — chup raho

  for (const d of digest.values()) {
    // ─── EMAILS — won aur cancelled ki ALAG ALAG ─────────
    if (d.won.length > 0) {
      try {
        await sendOrdersWonSummaryEmail({
          toEmail: d.email, managerName: d.managerName, orders: d.won,
          billNumber: billMap.get(String(d.branchId)) || null,
        });
      } catch (err) {
        console.error(`Won email failed for ${d.email}:`, err.message);
      }
    }

    if (d.cancelled.length > 0) {
      try {
        await sendOrdersCancelledSummaryEmail({
          toEmail: d.email, managerName: d.managerName, orders: d.cancelled,
        });
      } catch (err) {
        console.error(`Cancelled email failed for ${d.email}:`, err.message);
      }
    }

    // ─── PUSH — won + cancelled dono EK hi notification me ───
    //  Push alag try me hai: email fail ho to push phir bhi jaye, aur ulta bhi.
    try {
      const grandTotal = Math.round(
        d.won.reduce((s, o) => s + (o.totalAmount || 0), 0) * 100
      ) / 100;

      await notifyBiddingResult(d.branchId, {
        wonCount:       d.won.length,
        cancelledCount: d.cancelled.length,
        grandTotal,
      }, d.fcmTokens);
    } catch (err) {
      console.error(`Bidding result push failed for ${d.branchId}:`, err.message);
    }
  }

  console.log(`📧 Emails + 🔔 push → ${digest.size} buyer(s)`);
};

// ─────────────────────────────────────────────────────────
//  TRIGGER 4 — Bidding start pe eligible suppliers ko notify karo
//
//  "Eligible" ka matlab BILKUL wahi rule jo getActiveBiddings use karta hai
//  (bids.js) — warna supplier ko notification aayegi aur app me bidding
//  dikhegi hi nahi:
//      SupplierItem: isListed = true  AND  isAvailableToday = true
//  Aur upar se branch approved + active + banned nahi (getTokensForBranches).
//
//  Ek supplier ke liye 3 biddings khuli hon to bhi EK hi push jaati hai.
// ─────────────────────────────────────────────────────────
const notifyEligibleSuppliers = async (openedBulkOrders) => {
  if (!openedBulkOrders || openedBulkOrders.length === 0) return;

  try {
    // supplierBranchId(string) → { count, sampleItem }
    const perSupplier = new Map();

    for (const { platformItemId, countryId, itemName } of openedBulkOrders) {
      const supplierItems = await SupplierItem.find({
        platformItemId,
        countryId,
        isListed:         true,
        isAvailableToday: true,
      }).select("branchId");

      // Ek hi branch ke same item ke do record ho to double count na ho
      const seen = new Set();
      for (const si of supplierItems) {
        const bid = String(si.branchId);
        if (seen.has(bid)) continue;
        seen.add(bid);

        if (!perSupplier.has(bid)) {
          perSupplier.set(bid, { count: 0, sampleItem: itemName || null });
        }
        perSupplier.get(bid).count += 1;
      }
    }

    if (perSupplier.size === 0) {
      console.log("🔔 Bidding start — koi eligible supplier nahi");
      return;
    }

    // Sab tokens EK query me — 50 supplier ho to 50 query nahi maarni
    const tokenMap = await getTokensForBranches([...perSupplier.keys()]);

    let pushed = 0;
    for (const [branchId, info] of perSupplier.entries()) {
      const tokens = tokenMap.get(branchId);
      if (!tokens) continue;   // app install nahi / logout / approved nahi

      try {
        await notifyBiddingStarted(branchId, {
          biddingCount: info.count,
          sampleItem:   info.sampleItem,
        }, tokens);
        pushed += 1;
      } catch (err) {
        console.error(`Bidding start push failed for ${branchId}:`, err.message);
      }
    }

    console.log(`🔔 Bidding start push → ${pushed} supplier(s) of ${perSupplier.size} eligible`);
  } catch (err) {
    // Notification fail hona bidding ko kabhi na toray
    console.error("notifyEligibleSuppliers error:", err.message);
  }
};

// ─────────────────────────────────────────────────────────
//  Missed bids record karo
// ─────────────────────────────────────────────────────────
const recordMissedBids = async (bulkOrder) => {
  const eligible = await SupplierItem.find({
    platformItemId: bulkOrder.platformItemId,
    countryId:      bulkOrder.countryId,
    isListed:       true,
  });

  const seen = new Set();
  for (const si of eligible) {
    const sid = si.branchId.toString();
    if (seen.has(sid)) continue;
    seen.add(sid);

    const existing = await Bid.findOne({
      bulkOrderId:      bulkOrder._id,
      supplierBranchId: si.branchId,
    });
    if (existing) continue;

    const branch = await Branch.findById(si.branchId).select("companyId");
    if (!branch) continue;

    try {
      await Bid.create({
        bulkOrderId:       bulkOrder._id,
        supplierBranchId:  si.branchId,
        supplierCompanyId: branch.companyId,
        pricePerUnit:      null,
        status:            "missed",
      });
    } catch (e) {}
  }
};

// ═══════════════════════════════════════════════
// 1) Bidding Start
// ═══════════════════════════════════════════════
const runBiddingStart = async (settings) => {
  console.log("⏰ Bidding Start Cron...");
  try {
    const { start: dayStart, end: dayEnd } = getQatarDayRange();

    const pendingOrders = await BuyerOrder.find({
      status:  "pending",
      bidDate: { $gte: dayStart, $lt: dayEnd },
    });

    if (pendingOrders.length === 0) {
      console.log("❌ Koi pending order nahi");
      return;
    }
    console.log(`📦 ${pendingOrders.length} pending orders mile`);

    const groups = {};
    for (const order of pendingOrders) {
      const key = `${order.platformItemId}_${order.countryId}`;
      if (!groups[key]) {
        const supplierItems = await SupplierItem.find({
          platformItemId:   order.platformItemId,
          countryId:        order.countryId,
          isListed:         true,
          isAvailableToday: true,
        });
        const prices   = supplierItems.map((s) => s.pricePerUnit);
        const minPrice = prices.length > 0 ? Math.min(...prices) : null;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

        groups[key] = {
          platformItemId: order.platformItemId,
          countryId:      order.countryId,
          totalQuantity:  0,
          buyerOrderIds:  [],
          minPrice,
          maxPrice,
        };
      }
      groups[key].totalQuantity += order.quantity;
      groups[key].buyerOrderIds.push(order._id);
    }

    const biddingStartsAt = buildStartAt(settings);
    const biddingEndsAt   = buildEndAt(settings);

    console.log(`🕒 Start: ${biddingStartsAt.toISOString()} | End: ${biddingEndsAt.toISOString()}`);

    // Jo biddings actually khuli — inhi ke eligible suppliers ko notify karenge (Trigger 4)
    const openedBulkOrders = [];

    for (const key of Object.keys(groups)) {
      const g = groups[key];

      const existingBulk = await BulkOrder.findOne({
        platformItemId: g.platformItemId,
        countryId:      g.countryId,
        status:         "bidding",
      });

      if (existingBulk) {
        const newOrderIds = g.buyerOrderIds.filter(
          (id) => !existingBulk.buyerOrderIds.map(String).includes(String(id))
        );
        if (newOrderIds.length > 0) {
          await BulkOrder.findByIdAndUpdate(existingBulk._id, {
            $inc:  { totalQuantity: g.totalQuantity },
            $push: { buyerOrderIds: { $each: newOrderIds } },
            bidDate:       biddingStartsAt,
            biddingEndsAt,
            minPrice:      g.minPrice,
            maxPrice:      g.maxPrice,
          });
          await BuyerOrder.updateMany(
            { _id: { $in: newOrderIds } },
            { status: "in_bidding", bulkOrderId: existingBulk._id }
          );
        } else {
          await BuyerOrder.updateMany(
            { _id: { $in: g.buyerOrderIds } },
            { status: "in_bidding" }
          );
        }
        // NAYE orders add hue tabhi notification — warna roz same bidding pe
        // supplier ko dobara push jaata rahega
        if (newOrderIds.length > 0) {
          openedBulkOrders.push({
            platformItemId: g.platformItemId,
            countryId:      g.countryId,
          });
        }

        console.log(`♻️ BulkOrder updated: ${existingBulk._id}`);
      } else {
        const bulkOrder = await BulkOrder.create({
          platformItemId: g.platformItemId,
          countryId:      g.countryId,
          totalQuantity:  g.totalQuantity,
          buyerOrderIds:  g.buyerOrderIds,
          bidDate:        biddingStartsAt,
          biddingEndsAt,
          retryCount:     1,
          minPrice:       g.minPrice,
          maxPrice:       g.maxPrice,
        });
        await BuyerOrder.updateMany(
          { _id: { $in: g.buyerOrderIds } },
          { status: "in_bidding", bulkOrderId: bulkOrder._id }
        );
        openedBulkOrders.push({
          platformItemId: g.platformItemId,
          countryId:      g.countryId,
        });

        console.log(`✅ BulkOrder: ${bulkOrder._id}`);
      }
    }

    // ─── TRIGGER 4 — item ke naam bhar do, phir eligible suppliers ko push ───
    for (const o of openedBulkOrders) {
      const item = await PlatformItem.findById(o.platformItemId).select("name");
      o.itemName = item?.name || null;
    }
    await notifyEligibleSuppliers(openedBulkOrders);
  } catch (err) {
    console.error("Bidding Start error:", err);
  }
};

// ═══════════════════════════════════════════════
// 2) Winner Select
// ═══════════════════════════════════════════════
const runWinnerSelect = async (settings) => {
  console.log("⏰ Winner Select Cron...");

  // ─── Buyer wise email digest ───────────────────────────
  //  try se BAHAR declare kiya hai taake `finally` isay access kar sake —
  //  cron beech me crash ho jaye to bhi jo orders process ho chuke,
  //  un ki email chali jaye (warna buyer ko invoice mil jata aur email nahi)
  const buyerDigest = new Map();

  try {
    // ─── Counter initialize karo — ek baar sab buyer orders ke liye ───
    await initInvoiceCounter();

    // ─── Commission settings DB se fetch karo ────────
    const commSettings = await getCommissionSettings();
    const COMMISSION_PCT = commSettings.platformCommission / 100;  // e.g. 0.02
    const DELIVERY_PCT   = commSettings.deliveryFee         / 100;  // e.g. 0.01
    const BUYER_DUE_DAYS = commSettings.buyerPaymentDays;           // e.g. 30

    const activeBulkOrders = await BulkOrder.find({ status: "bidding" });
    if (activeBulkOrders.length === 0) {
      console.log("❌ Koi active bulk order nahi");
      return;
    }

    for (const bulkOrder of activeBulkOrders) {
      const platformItem = await PlatformItem.findById(bulkOrder.platformItemId);
      const country      = await Country.findById(bulkOrder.countryId);
      const winningBid   = await Bid.findOne({
        bulkOrderId:  bulkOrder._id,
        pricePerUnit: { $ne: null },
      }).sort({ pricePerUnit: 1 });

      // ─── No bid → CANCEL ───────────────────────────────
      if (!winningBid) {
        await BulkOrder.findByIdAndUpdate(bulkOrder._id, { status: "cancelled" });

        const buyerOrders = await BuyerOrder.find({
          _id: { $in: bulkOrder.buyerOrderIds },
        }).populate("buyerBranchId");

        for (const bo of buyerOrders) {
          await BuyerOrder.findByIdAndUpdate(bo._id, {
            status: "cancelled", estimatedAmount: 0,
          });
          pushToDigest(buyerDigest, bo.buyerBranchId, "cancelled", {
            itemName: platformItem?.name,
            country:  country?.name,
            quantity: bo.quantity,
            unit:     platformItem?.unit,
          });
        }

        await recordMissedBids(bulkOrder);
        console.log(`❌ No supplier — cancelled: ${bulkOrder._id}`);
        continue;
      }

      // ─── Winner found ──────────────────────────────────
      await BulkOrder.findByIdAndUpdate(bulkOrder._id, {
        status:           "awarded",
        winnerSupplierId: winningBid.supplierBranchId,
        winningPrice:     winningBid.pricePerUnit,
      });

      await Bid.findByIdAndUpdate(winningBid._id, { status: "won" });
      await Bid.updateMany(
        {
          bulkOrderId:  bulkOrder._id,
          _id:          { $ne: winningBid._id },
          pricePerUnit: { $ne: null },
        },
        { status: "lost" }
      );

      await recordMissedBids(bulkOrder);

      const buyerOrders = await BuyerOrder.find({
        _id: { $in: bulkOrder.buyerOrderIds },
      }).populate("buyerBranchId");

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

      for (const bo of buyerOrders) {
        const rawTotal         = bo.quantity * winningBid.pricePerUnit;
        const commissionAmount = Math.round(rawTotal * COMMISSION_PCT * 100) / 100;
        const deliveryAmount   = Math.round(rawTotal * DELIVERY_PCT   * 100) / 100;
        const totalFeeAmount   = commissionAmount + deliveryAmount;
        const buyerGrandTotal  = Math.round((rawTotal + totalFeeAmount) * 100) / 100;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + BUYER_DUE_DAYS);

        // ─── LOCKED invoice number — same for buyer & supplier ───
        const invNum         = nextInvNum();  // ← atomic increment, no DB call
        const buyerInvNum    = `INV-B-${dateStr}-${invNum}`;
        const supplierInvNum = `INV-S-${dateStr}-${invNum}`;

        // ─── Buyer invoice ────────────────────────────────
        const buyerInvoiceDoc = await Invoice.create({
          buyerOrderId:     bo._id,
          bulkOrderId:      bulkOrder._id,
          buyerBranchId:    bo.buyerBranchId._id,
          buyerCompanyId:   bo.buyerCompanyId,
          supplierBranchId: winningBid.supplierBranchId,
          platformItemId:   bulkOrder.platformItemId,
          countryId:        bulkOrder.countryId,
          invoiceNumber:    buyerInvNum,
          invoiceType:      "buyer",
          invoiceStatus:    "final",
          quantity:         bo.quantity,
          unit:             platformItem?.unit,
          pricePerUnit:     winningBid.pricePerUnit,
          totalAmount:      rawTotal,
          commissionAmount,
          deliveryAmount,
          totalFeeAmount,
          grandTotal:       buyerGrandTotal,
          deliveryCharge:   0,
          amountDue:        buyerGrandTotal,
          dueDate,
        });

        // ─── Supplier invoice — SAME invNum ───────────────
        const supplierInvoiceDoc = await Invoice.create({
          buyerOrderId:     bo._id,
          bulkOrderId:      bulkOrder._id,
          buyerBranchId:    bo.buyerBranchId._id,
          buyerCompanyId:   bo.buyerCompanyId,
          supplierBranchId: winningBid.supplierBranchId,
          platformItemId:   bulkOrder.platformItemId,
          countryId:        bulkOrder.countryId,
          invoiceNumber:    supplierInvNum,
          invoiceType:      "supplier",
          invoiceStatus:    "final",
          quantity:         bo.quantity,
          unit:             platformItem?.unit,
          pricePerUnit:     winningBid.pricePerUnit,
          totalAmount:      rawTotal,
          commissionAmount: 0,
          deliveryAmount:   0,
          totalFeeAmount:   0,
          grandTotal:       rawTotal,
          deliveryCharge:   0,
          amountDue:        rawTotal,
          dueDate,
          supplierPaymentStatus: "pending",
        });

        // ─── Ledger — supplier earns the full order amount, platform earns its 2% ───
        // (rider's 1% is credited separately at actual delivery time — see riderDelivery.js)
        try {
          await ledger.creditSupplier(
            winningBid.supplierBranchId, rawTotal, "order_earning",
            { invoiceId: supplierInvoiceDoc._id, bulkOrderId: bulkOrder._id, buyerOrderId: bo._id },
            `Order earning — ${supplierInvNum}`
          );
          await ledger.creditPlatform(
            commissionAmount, "commission",
            { invoiceId: buyerInvoiceDoc._id, bulkOrderId: bulkOrder._id, buyerOrderId: bo._id },
            `Platform commission — ${buyerInvNum}`
          );
        } catch (ledgerErr) {
          console.error("Ledger entry error (order won):", ledgerErr);
        }

        pushToDigest(buyerDigest, bo.buyerBranchId, "won", {
          invoiceNumber: buyerInvNum,
          itemName:     platformItem?.name,
          country:      country?.name,
          quantity:     bo.quantity,
          unit:         platformItem?.unit,
          pricePerUnit: Math.round(winningBid.pricePerUnit * 1.03 * 100) / 100,
          totalAmount:  buyerGrandTotal,
        });

        await BuyerOrder.findByIdAndUpdate(bo._id, {
          status:          "won",
          estimatedAmount: 0,
        });

        console.log(`🧾 Buyer: ${buyerInvNum} | Supplier: ${supplierInvNum}`);
      }

      console.log(`✅ Winner: ${winningBid.pricePerUnit} QAR`);
    }
  } catch (err) {
    console.error("Winner Cron error:", err);
  } finally {
    // ─── BILL INVOICES — aaj ke saare item invoices ka header bill ───
    //  Emails se PEHLE chalta hai taake won email me BILL-B-… number aa sake.
    //  generateDailyBills khud kabhi throw nahi karti — fail ho to bills
    //  Map khaali aayega aur email pehle jaisa hi chala jayega.
    let bills = { buyer: new Map(), supplier: new Map() };
    try {
      const cs = await getCommissionSettings();
      bills = await generateDailyBills({
        buyerDueDays:    cs?.buyerPaymentDays    || 30,
        supplierDueDays: cs?.supplierPaymentDays || 60,
      });
    } catch (billErr) {
      console.error("Bill generation skipped:", billErr.message);
    }

    // ─── Har haal me emails bhejo ─────────────────────────
    //  Upar crash bhi ho gaya to jitne orders process ho chuke the,
    //  un ki summary email phir bhi jaayegi
    await flushDigest(buyerDigest, bills.buyer);
  }
};

// ═══════════════════════════════════════════════
// 3) Schedule / Reschedule
// ═══════════════════════════════════════════════
const scheduleCrons = async () => {
  const s = await getBiddingSettings();

  if (biddingStartJob) biddingStartJob.stop();
  if (winnerJob)       winnerJob.stop();

  const startExpr  = `${s.BIDDING_START_MIN} ${s.BIDDING_START_HOUR} * * *`;
  const winnerExpr = `${s.WINNER_MIN} ${s.WINNER_HOUR} * * *`;

  biddingStartJob = cron.schedule(
    startExpr,
    async () => {
      const latest = await getBiddingSettings();
      await runBiddingStart(latest);
    },
    { timezone: "Asia/Qatar" }
  );

  winnerJob = cron.schedule(
    winnerExpr,
    async () => {
      const latest = await getBiddingSettings();
      await runWinnerSelect(latest);
    },
    { timezone: "Asia/Qatar" }
  );

  console.log(`🕒 Crons set → Start: ${startExpr} | Winner: ${winnerExpr} (Qatar)`);
};

module.exports = {
  scheduleCrons,
  runBiddingStart,
  runWinnerSelect,
};