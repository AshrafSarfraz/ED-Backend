// 📁 cron/biddingCron.js
const cron = require("node-cron");
const BuyerOrder   = require("../models/buyer/buyerOrder");
const BulkOrder    = require("../models/BulkOrder");
const Bid          = require("../models/Bid");
const PlatformItem = require("../models/PlatformItem");
const Country      = require("../models/Country");
const Invoice      = require("../models/invoice");
const SupplierItem = require("../models/supplier/supplierCatalog");
const Branch       = require("../models/Branch");
const { getBiddingSettings } = require("./settingService");
const {
  sendNoBidEmail,
  sendOrderCancelledEmail,
  sendOrderWonEmail,
} = require("../utils/sendEmail");

// ─── Active job handles (taake stop/reschedule kar sakein) ───
let biddingStartJob = null;
let winnerJob       = null;

const getQatarToday = () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  today.setTime(today.getTime() - 3 * 60 * 60 * 1000);
  return today;
};

const getQatarTomorrow = () => {
  const t = getQatarToday();
  t.setTime(t.getTime() + 24 * 60 * 60 * 1000);
  return t;
};

// ═══════════════════════════════════════════════
// 1) Bidding Start logic
// ═══════════════════════════════════════════════
const runBiddingStart = async (settings) => {
  console.log("⏰ Bidding Start Cron...");
  try {
    const today    = getQatarToday();
    const tomorrow = getQatarTomorrow();

    const pendingOrders = await BuyerOrder.find({
      status:  "pending",
      bidDate: { $gte: today, $lt: tomorrow },
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

    // biddingEndsAt = winner cron ke time pe (DB settings se)
    const biddingEndsAt = new Date();
    biddingEndsAt.setUTCHours(settings.WINNER_HOUR - 3, settings.WINNER_MIN, 0, 0);

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
            biddingEndsAt,
            minPrice: g.minPrice,
            maxPrice: g.maxPrice,
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
        console.log(`♻️ BulkOrder updated: ${existingBulk._id}`);
      } else {
        const bulkOrder = await BulkOrder.create({
          platformItemId: g.platformItemId,
          countryId:      g.countryId,
          totalQuantity:  g.totalQuantity,
          buyerOrderIds:  g.buyerOrderIds,
          bidDate:        today,
          biddingEndsAt,
          retryCount:     1,
          minPrice:       g.minPrice,
          maxPrice:       g.maxPrice,
        });
        await BuyerOrder.updateMany(
          { _id: { $in: g.buyerOrderIds } },
          { status: "in_bidding", bulkOrderId: bulkOrder._id }
        );
        console.log(`✅ BulkOrder: ${bulkOrder._id}`);
      }
    }
  } catch (err) {
    console.error("Bidding Start error:", err);
  }
};

// ═══════════════════════════════════════════════
// 2) Winner Select logic
// ═══════════════════════════════════════════════
const runWinnerSelect = async (settings) => {
  console.log("⏰ Winner Select Cron...");
  try {
    const activeBulkOrders = await BulkOrder.find({ status: "bidding" });
    if (activeBulkOrders.length === 0) {
      console.log("❌ Koi active bulk order nahi");
      return;
    }

    for (const bulkOrder of activeBulkOrders) {
      const platformItem = await PlatformItem.findById(bulkOrder.platformItemId);
      const country      = await Country.findById(bulkOrder.countryId);
      const winningBid   = await Bid.findOne({ bulkOrderId: bulkOrder._id })
        .sort({ pricePerUnit: 1 });

      // ─── No bid ───────────────────────────────────────
      if (!winningBid) {
        if (bulkOrder.retryCount >= 3) {
          await BulkOrder.findByIdAndUpdate(bulkOrder._id, { status: "cancelled" });

          const buyerOrders = await BuyerOrder.find({
            _id: { $in: bulkOrder.buyerOrderIds },
          }).populate("buyerBranchId");

          for (const bo of buyerOrders) {
            await BuyerOrder.findByIdAndUpdate(bo._id, {
              status: "cancelled", estimatedAmount: 0,
            });
            await sendOrderCancelledEmail({
              toEmail:     bo.buyerBranchId.email,
              managerName: bo.buyerBranchId.managerName,
              itemName:    platformItem?.name,
              country:     country?.name,
            });
          }
          console.log(`❌ Cancelled: ${bulkOrder._id}`);
        } else {
          const tomorrow          = getQatarTomorrow();
          const nextBiddingEndsAt = new Date(tomorrow);
          nextBiddingEndsAt.setUTCHours(settings.WINNER_HOUR - 3, settings.WINNER_MIN, 0, 0);

          const buyerOrders = await BuyerOrder.find({
            _id: { $in: bulkOrder.buyerOrderIds },
          }).populate("buyerBranchId");

          const retryIds  = [];
          const cancelIds = [];

          for (const bo of buyerOrders) {
            const branch = await Branch.findById(bo.buyerBranchId._id);
            if (!branch?.pdcAmount) { cancelIds.push(bo._id); continue; }

            const pendingResult = await Invoice.aggregate([
              {
                $match: {
                  buyerBranchId: bo.buyerBranchId._id,
                  invoiceType:   "buyer",
                  paymentStatus: { $in: ["unpaid", "partial", "overdue"] },
                },
              },
              { $group: { _id: null, total: { $sum: "$amountDue" } } },
            ]);

            const currentPending  = pendingResult[0]?.total || 0;
            const remaining       = branch.pdcAmount - currentPending;
            const supplierItems   = await SupplierItem.find({
              platformItemId:   bulkOrder.platformItemId,
              countryId:        bulkOrder.countryId,
              isListed:         true,
              isAvailableToday: true,
            });
            const prices          = supplierItems.map((s) => s.pricePerUnit);
            const maxPrice        = prices.length > 0 ? Math.max(...prices) : null;
            const estimatedAmount = maxPrice ? maxPrice * bo.quantity : 0;

            if (remaining <= 0 || (maxPrice && estimatedAmount > remaining)) {
              cancelIds.push(bo._id);
            } else {
              retryIds.push(bo._id);
            }
          }

          if (cancelIds.length > 0) {
            await BuyerOrder.updateMany(
              { _id: { $in: cancelIds } },
              { status: "cancelled", estimatedAmount: 0 }
            );
            for (const bo of buyerOrders.filter((b) => cancelIds.map(String).includes(String(b._id)))) {
              await sendOrderCancelledEmail({
                toEmail:     bo.buyerBranchId.email,
                managerName: bo.buyerBranchId.managerName,
                itemName:    platformItem?.name,
                country:     country?.name,
              });
            }
          }

          if (retryIds.length > 0) {
            await BulkOrder.findByIdAndUpdate(bulkOrder._id, {
              retryCount:    bulkOrder.retryCount + 1,
              bidDate:       tomorrow,
              biddingEndsAt: nextBiddingEndsAt,
              buyerOrderIds: retryIds,
              totalQuantity: buyerOrders
                .filter((b) => retryIds.map(String).includes(String(b._id)))
                .reduce((sum, b) => sum + b.quantity, 0),
            });

            await BuyerOrder.updateMany(
              { _id: { $in: retryIds } },
              { status: "pending", bidDate: tomorrow }
            );

            for (const bo of buyerOrders.filter((b) => retryIds.map(String).includes(String(b._id)))) {
              await sendNoBidEmail({
                toEmail:     bo.buyerBranchId.email,
                managerName: bo.buyerBranchId.managerName,
                itemName:    platformItem?.name,
                country:     country?.name,
                dayCount:    bulkOrder.retryCount,
              });
            }
            console.log(`🔄 Retry ${bulkOrder.retryCount + 1}/3`);
          } else {
            await BulkOrder.findByIdAndUpdate(bulkOrder._id, { status: "cancelled" });
          }
        }
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
        { bulkOrderId: bulkOrder._id, _id: { $ne: winningBid._id } },
        { status: "lost" }
      );

      const supplierBranch = await Branch.findById(winningBid.supplierBranchId);
      const packingDays    = supplierBranch?.defaultPackingDays || 2;

      const buyerOrders = await BuyerOrder.find({
        _id: { $in: bulkOrder.buyerOrderIds },
      }).populate("buyerBranchId");

      for (const bo of buyerOrders) {
        const rawTotal         = bo.quantity * winningBid.pricePerUnit;
        const commissionAmount = Math.round(rawTotal * 0.02 * 100) / 100;
        const deliveryAmount   = Math.round(rawTotal * 0.01 * 100) / 100;
        const totalFeeAmount   = commissionAmount + deliveryAmount;
        const buyerGrandTotal  = Math.round((rawTotal + totalFeeAmount) * 100) / 100;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

        // ─── Buyer Invoice ─────────────────────────────
        const buyerCount  = await Invoice.countDocuments();
        const buyerInvNum = `INV-B-${dateStr}-${String(buyerCount + 1).padStart(4, "0")}`;

        await Invoice.create({
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

        // ─── Supplier Invoice ──────────────────────────
        const supplierCount  = await Invoice.countDocuments();
        const supplierInvNum = `INV-S-${dateStr}-${String(supplierCount + 1).padStart(4, "0")}`;

        await Invoice.create({
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

        // Email buyer
        await sendOrderWonEmail({
          toEmail:      bo.buyerBranchId.email,
          managerName:  bo.buyerBranchId.managerName,
          itemName:     platformItem?.name,
          country:      country?.name,
          quantity:     bo.quantity,
          unit:         platformItem?.unit,
          pricePerUnit: Math.round(winningBid.pricePerUnit * 1.03 * 100) / 100,
          totalAmount:  buyerGrandTotal,
          packingDays,
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
  }
};

// ═══════════════════════════════════════════════
// 3) Schedule / Reschedule
// ═══════════════════════════════════════════════
const scheduleCrons = async () => {
  const s = await getBiddingSettings();

  // Purane jobs band karo
  if (biddingStartJob) biddingStartJob.stop();
  if (winnerJob)       winnerJob.stop();

  // cron expression: "min hour * * *" (Asia/Qatar)
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