const cron = require("node-cron");
const BuyerOrder   = require("../models/buyer/buyerOrder");
const BulkOrder    = require("../models/BulkOrder");
const Bid          = require("../models/Bid");
const PlatformItem = require("../models/PlatformItem");
const Country      = require("../models/Country");
const Invoice      = require("../models/invoice");
const SupplierItem = require("../models/supplier/supplierCatalog");
const {
  sendNoBidEmail,
  sendOrderCancelledEmail,
  sendOrderWonEmail,
} = require("../utils/sendEmail");

// ═══════════════════════════════════════════════
// ⚙️  SETTINGS — sirf yahan change karo
// ═══════════════════════════════════════════════
const SETTINGS = {
  BULK_ORDER_CRON:    "5 15 * * *",  // 2PM Qatar — bidding start
  WINNER_CRON:        "20 15 * * *",  // 3PM Qatar — bidding end
  BIDDING_END_UTC_HR: 12,            // 3PM Qatar = 12 UTC
};
// ═══════════════════════════════════════════════

// ─── Helper: Qatar Today ──────────────────────
const getQatarToday = () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  today.setTime(today.getTime() - (3 * 60 * 60 * 1000));
  return today;
};

const getQatarTomorrow = () => {
  const tomorrow = getQatarToday();
  tomorrow.setTime(tomorrow.getTime() + (24 * 60 * 60 * 1000));
  return tomorrow;
};

// ═══════════════════════════════════════════════
// 2PM Qatar — Bulk Orders banao
// ═══════════════════════════════════════════════
cron.schedule(SETTINGS.BULK_ORDER_CRON, async () => {
  console.log("⏰ 2PM Cron: Bulk Orders bana raha hai...");
  try {
    const today    = getQatarToday();
    const tomorrow = getQatarTomorrow();

    console.log("Today range:", today, "→", tomorrow);

    const pendingOrders = await BuyerOrder.find({
      status:  "pending",
      bidDate: { $gte: today, $lt: tomorrow },
    });

    if (pendingOrders.length === 0) {
      console.log("❌ Koi pending order nahi aaj ka");
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

        const prices   = supplierItems.map(s => s.pricePerUnit);
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

    // 3PM Qatar = 12:00 UTC
    const biddingEndsAt = new Date();
    biddingEndsAt.setUTCHours(SETTINGS.BIDDING_END_UTC_HR, 0, 0, 0);

    for (const key of Object.keys(groups)) {
      const g = groups[key];

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

      console.log(`✅ BulkOrder: ${bulkOrder._id} | ${g.minPrice}-${g.maxPrice} QAR`);
    }

  } catch (err) {
    console.error("2PM Cron error:", err);
  }
}, { timezone: "Asia/Qatar" });

// ═══════════════════════════════════════════════
// 3PM Qatar — Winner select karo
// ═══════════════════════════════════════════════
cron.schedule(SETTINGS.WINNER_CRON, async () => {
  console.log("⏰ 3PM Cron: Winner select kar raha hai...");
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

      // ─── No bid ───────────────────────────────
      if (!winningBid) {

        if (bulkOrder.retryCount >= 3) {
          await BulkOrder.findByIdAndUpdate(bulkOrder._id, { status: "cancelled" });

          const buyerOrders = await BuyerOrder.find({
            _id: { $in: bulkOrder.buyerOrderIds }
          }).populate("buyerBranchId");

          for (const bo of buyerOrders) {
            await sendOrderCancelledEmail({
              toEmail:     bo.buyerBranchId.email,
              managerName: bo.buyerBranchId.managerName,
              itemName:    platformItem?.name,
              country:     country?.name,
            });
            await BuyerOrder.findByIdAndUpdate(bo._id, { status: "cancelled" });
          }
          console.log(`❌ 3 din — cancelled`);

        } else {
          const tomorrow          = getQatarTomorrow();
          const nextBiddingEndsAt = new Date(tomorrow);
          nextBiddingEndsAt.setUTCHours(SETTINGS.BIDDING_END_UTC_HR, 0, 0, 0);

          await BulkOrder.findByIdAndUpdate(bulkOrder._id, {
            retryCount:    bulkOrder.retryCount + 1,
            bidDate:       tomorrow,
            biddingEndsAt: nextBiddingEndsAt,
          });

          await BuyerOrder.updateMany(
            { _id: { $in: bulkOrder.buyerOrderIds } },
            { status: "pending", bidDate: tomorrow }
          );

          const buyerOrders = await BuyerOrder.find({
            _id: { $in: bulkOrder.buyerOrderIds }
          }).populate("buyerBranchId");

          for (const bo of buyerOrders) {
            await sendNoBidEmail({
              toEmail:     bo.buyerBranchId.email,
              managerName: bo.buyerBranchId.managerName,
              itemName:    platformItem?.name,
              country:     country?.name,
              dayCount:    bulkOrder.retryCount,
            });
          }
          console.log(`🔄 Retry ${bulkOrder.retryCount + 1}`);
        }

        continue;
      }

      // ─── Winner found ─────────────────────────
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

      const buyerOrders = await BuyerOrder.find({
        _id: { $in: bulkOrder.buyerOrderIds }
      }).populate("buyerBranchId");

      for (const bo of buyerOrders) {
        const totalAmount = bo.quantity * winningBid.pricePerUnit;
        const dueDate     = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        const count         = await Invoice.countDocuments();
        const invoiceNumber = `INV-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${String(count + 1).padStart(4, "0")}`;

        await Invoice.create({
          buyerOrderId:     bo._id,
          bulkOrderId:      bulkOrder._id,
          buyerBranchId:    bo.buyerBranchId._id,
          buyerCompanyId:   bo.buyerCompanyId,
          supplierBranchId: winningBid.supplierBranchId,
          platformItemId:   bulkOrder.platformItemId,
          countryId:        bulkOrder.countryId,
          invoiceNumber,
          quantity:         bo.quantity,
          unit:             platformItem?.unit,
          pricePerUnit:     winningBid.pricePerUnit,
          totalAmount,
          deliveryCharge:   0,
          grandTotal:       totalAmount,
          amountDue:        totalAmount,
          dueDate,
          invoiceStatus:    "draft",
        });

        await sendOrderWonEmail({
          toEmail:      bo.buyerBranchId.email,
          managerName:  bo.buyerBranchId.managerName,
          itemName:     platformItem?.name,
          country:      country?.name,
          quantity:     bo.quantity,
          unit:         platformItem?.unit,
          pricePerUnit: winningBid.pricePerUnit,
          totalAmount,
        });

        await BuyerOrder.findByIdAndUpdate(bo._id, { status: "won" });
        console.log(`🧾 Invoice: ${invoiceNumber}`);
      }

      console.log(`✅ Winner: ${winningBid.pricePerUnit} QAR`);
    }

  } catch (err) {
    console.error("3PM Cron error:", err);
  }
}, { timezone: "Asia/Qatar" });