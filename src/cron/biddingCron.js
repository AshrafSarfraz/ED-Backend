const cron = require("node-cron");
const BuyerOrder   = require("../models/buyer/buyerOrder");
const BulkOrder    = require("../models/BulkOrder");
const Bid          = require("../models/Bid");
const Branch       = require("../models/branch");
const PlatformItem = require("../models/PlatformItem");
const Country      = require("../models/Country");
const Invoice      = require("../models/invoice"); // ← naya
const {
  sendNoBidEmail,
  sendOrderCancelledEmail,
  sendOrderWonEmail,
} = require("../utils/sendEmail");

// ═══════════════════════════════════════════════
// 6PM — Bulk Orders banao
// ═══════════════════════════════════════════════
cron.schedule("0 18 * * *", async () => {
  console.log("⏰ 6PM Cron: Bulk Orders bana raha hai...");
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingOrders = await BuyerOrder.find({
      status:  "pending",
      bidDate: today,
    });

    if (pendingOrders.length === 0) {
      console.log("❌ Koi pending order nahi aaj ka");
      return;
    }

    const groups = {};
    for (const order of pendingOrders) {
      const key = `${order.platformItemId}_${order.countryId}`;
      if (!groups[key]) {
        groups[key] = {
          platformItemId: order.platformItemId,
          countryId:      order.countryId,
          totalQuantity:  0,
          buyerOrderIds:  [],
        };
      }
      groups[key].totalQuantity += order.quantity;
      groups[key].buyerOrderIds.push(order._id);
    }

    const biddingEndsAt = new Date();
    biddingEndsAt.setHours(22, 0, 0, 0);

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
      });

      await BuyerOrder.updateMany(
        { _id: { $in: g.buyerOrderIds } },
        { status: "in_bidding", bulkOrderId: bulkOrder._id }
      );

      console.log(`✅ BulkOrder created: ${bulkOrder._id}`);
    }

  } catch (err) {
    console.error("6PM Cron error:", err);
  }
}, { timezone: "Asia/Qatar" });

// ═══════════════════════════════════════════════
// 10PM — Winning bid select karo
// ═══════════════════════════════════════════════
cron.schedule("0 22 * * *", async () => {
  console.log("⏰ 10PM Cron: Winner select kar raha hai...");
  try {
    const activeBulkOrders = await BulkOrder.find({ status: "bidding" });

    for (const bulkOrder of activeBulkOrders) {

      const platformItem = await PlatformItem.findById(bulkOrder.platformItemId);
      const country      = await Country.findById(bulkOrder.countryId);

      const winningBid = await Bid.findOne({ bulkOrderId: bulkOrder._id })
        .sort({ pricePerUnit: 1 });

      // ─── No bid ───────────────────────────────
      if (!winningBid) {

        if (bulkOrder.retryCount >= 3) {
          await BulkOrder.findByIdAndUpdate(bulkOrder._id, { status: "cancelled" });

          const buyerOrders = await BuyerOrder.find({
            _id: { $in: bulkOrder.buyerOrderIds }
          }).populate("buyerBranchId");

          for (const bo of buyerOrders) {
            const branch = bo.buyerBranchId;
            await sendOrderCancelledEmail({
              toEmail:     branch.email,
              managerName: branch.managerName,
              itemName:    platformItem?.name,
              country:     country?.name,
            });
            await BuyerOrder.findByIdAndUpdate(bo._id, { status: "cancelled" });
          }

          console.log(`❌ 3 din ho gaye — BulkOrder ${bulkOrder._id} cancelled`);

        } else {
          const tomorrow = new Date();
          tomorrow.setHours(0, 0, 0, 0);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const nextBiddingEndsAt = new Date(tomorrow);
          nextBiddingEndsAt.setHours(22, 0, 0, 0);

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
            const branch = bo.buyerBranchId;
            await sendNoBidEmail({
              toEmail:     branch.email,
              managerName: branch.managerName,
              itemName:    platformItem?.name,
              country:     country?.name,
              dayCount:    bulkOrder.retryCount,
            });
          }

          console.log(`🔄 Retry ${bulkOrder.retryCount + 1} — BulkOrder ${bulkOrder._id} next day`);
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

      // Buyers ko won email bhejo + Invoice generate karo
      const buyerOrders = await BuyerOrder.find({
        _id: { $in: bulkOrder.buyerOrderIds }
      }).populate("buyerBranchId");

      for (const bo of buyerOrders) {
        const branch      = bo.buyerBranchId;
        const totalAmount = bo.quantity * winningBid.pricePerUnit;

        // ─── Invoice Generate ──────────────────
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        const count         = await Invoice.countDocuments();
        const invoiceNumber = `INV-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${String(count + 1).padStart(4, "0")}`;

        await Invoice.create({
          buyerOrderId:     bo._id,
          bulkOrderId:      bulkOrder._id,
          buyerBranchId:    branch._id,
          buyerCompanyId:   bo.buyerCompanyId,
          supplierBranchId: winningBid.supplierBranchId,
          platformItemId:   bulkOrder.platformItemId,
          countryId:        bulkOrder.countryId,
          invoiceNumber,
          quantity:         bo.quantity,
          unit:             platformItem?.unit,
          pricePerUnit:     winningBid.pricePerUnit,
          totalAmount,
          amountDue:        totalAmount,
          dueDate,
        });

        console.log(`🧾 Invoice generated: ${invoiceNumber}`);

        // ─── Email ─────────────────────────────
        await sendOrderWonEmail({
          toEmail:      branch.email,
          managerName:  branch.managerName,
          itemName:     platformItem?.name,
          country:      country?.name,
          quantity:     bo.quantity,
          unit:         platformItem?.unit,
          pricePerUnit: winningBid.pricePerUnit,
          totalAmount,
        });

        await BuyerOrder.findByIdAndUpdate(bo._id, { status: "won" });
      }

      console.log(`✅ Winner: ${winningBid.supplierBranchId} at ${winningBid.pricePerUnit} QAR`);
    }

  } catch (err) {
    console.error("10PM Cron error:", err);
  }
}, { timezone: "Asia/Qatar" });