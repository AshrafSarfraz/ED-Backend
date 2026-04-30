const cron = require("node-cron");
const BuyerOrder   = require("../models/buyer/buyerOrder");
const BulkOrder    = require("../models/BulkOrder");
const Bid          = require("../models/Bid");
const PlatformItem = require("../models/PlatformItem");
const Country      = require("../models/Country");
const Invoice      = require("../models/invoice");
const SupplierItem = require("../models/supplier/supplierCatalog");
const Branch       = require("../models/branch");
const {
  sendNoBidEmail,
  sendOrderCancelledEmail,
  sendOrderWonEmail,
} = require("../utils/sendEmail");

const COMMISSION_RATE = 0.03; // 3% total (2% platform + 1% delivery)

// ─── Helpers ──────────────────────────────────
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
// 2PM — Bulk Orders banao
// Pending BuyerOrders uthao (aaj ki bidDate wale)
// Agar usi item+country ka BulkOrder already hai to skip
// ═══════════════════════════════════════════════
cron.schedule("20 15 * * *", async () => {
  console.log("⏰ 2:20 PM Cron: BulkOrders bana raha hai...");
  try {
    const today    = getQatarToday();
    const tomorrow = getQatarTomorrow();

    // Aaj ki bidDate wale pending orders
    const pendingOrders = await BuyerOrder.find({
      status:  "pending",
      bidDate: { $gte: today, $lt: tomorrow },
    });

    if (pendingOrders.length === 0) {
      console.log("❌ Koi pending order nahi aaj ka");
      return;
    }

    console.log(`📦 ${pendingOrders.length} pending orders mile`);

    // Item+Country ke groups banao
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

    // Bidding 6PM Qatar = 3PM UTC
    const biddingEndsAt = new Date();
    biddingEndsAt.setUTCHours(30, 15, 0, 0, 0);

    for (const key of Object.keys(groups)) {
      const g = groups[key];

      // ─── Check: isi item+country ka BulkOrder already "bidding" mein hai?
      // (retry case — kal se carry forward hua order)
      const existingBulk = await BulkOrder.findOne({
        platformItemId: g.platformItemId,
        countryId:      g.countryId,
        status:         "bidding",
      });

      if (existingBulk) {
        // Sirf naye orders add karo agar koi naya aaya
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
          // Retry wale orders — sirf status update karo
          await BuyerOrder.updateMany(
            { _id: { $in: g.buyerOrderIds } },
            { status: "in_bidding" }
          );
        }

        console.log(`♻️  Existing BulkOrder updated: ${existingBulk._id}`);
      } else {
        // Naya BulkOrder banao
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

        console.log(`✅ New BulkOrder: ${bulkOrder._id} | ${g.minPrice}-${g.maxPrice} QAR`);
      }
    }
  } catch (err) {
    console.error("2PM Cron error:", err);
  }
}, { timezone: "Asia/Qatar" });

// ═══════════════════════════════════════════════
// 6PM — Winner select karo
// ═══════════════════════════════════════════════
cron.schedule("0 18 * * *", async () => {
  console.log("⏰ 6PM Cron: Winner select kar raha hai...");
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

      // ─── No bid — retry ya cancel ──────────────────────
      if (!winningBid) {

        if (bulkOrder.retryCount >= 3) {
          // 3 din ho gaye — sab cancel
          await BulkOrder.findByIdAndUpdate(bulkOrder._id, { status: "cancelled" });

          const buyerOrders = await BuyerOrder.find({
            _id: { $in: bulkOrder.buyerOrderIds },
          }).populate("buyerBranchId");

          for (const bo of buyerOrders) {
            await BuyerOrder.findByIdAndUpdate(bo._id, { status: "cancelled" });
            await sendOrderCancelledEmail({
              toEmail:     bo.buyerBranchId.email,
              managerName: bo.buyerBranchId.managerName,
              itemName:    platformItem?.name,
              country:     country?.name,
            });
          }
          console.log(`❌ 3 din no supplier — cancelled: ${bulkOrder._id}`);

        } else {
          // Retry — kal ki bidding mein shamil karo
          const tomorrow          = getQatarTomorrow();
          const nextBiddingEndsAt = new Date(tomorrow);
          nextBiddingEndsAt.setUTCHours(15, 0, 0, 0); // 6PM Qatar

          const buyerOrders = await BuyerOrder.find({
            _id: { $in: bulkOrder.buyerOrderIds },
          }).populate("buyerBranchId");

          // ─── Har BuyerOrder ka PDC check karo ────────
          // Agar PDC exceed ho gayi to cancel, warna retry
          const retryIds  = [];
          const cancelIds = [];

          for (const bo of buyerOrders) {
            const branch = await Branch.findById(bo.buyerBranchId._id);

            if (!branch?.pdcAmount) {
              // PDC nahi — cancel
              cancelIds.push(bo._id);
              continue;
            }

            // Remaining PDC nikaalo
            const pendingResult = await Invoice.aggregate([
              {
                $match: {
                  buyerBranchId: bo.buyerBranchId._id,
                  paymentStatus: { $in: ["unpaid", "partial", "overdue"] },
                },
              },
              { $group: { _id: null, total: { $sum: "$amountDue" } } },
            ]);
            const currentPending  = pendingResult[0]?.total || 0;
            const remaining       = branch.pdcAmount - currentPending;

            // Min price se estimated amount check karo
            const supplierItems = await SupplierItem.find({
              platformItemId:   bulkOrder.platformItemId,
              countryId:        bulkOrder.countryId,
              isListed:         true,
              isAvailableToday: true,
            });
            const prices   = supplierItems.map((s) => s.pricePerUnit);
            const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

            const estimatedAmount = maxPrice ? maxPrice * bo.quantity : 0;

            if (remaining <= 0 || (maxPrice && estimatedAmount > remaining)) {
              // PDC exceed — cancel this order
              cancelIds.push(bo._id);
              console.log(`❌ PDC exceeded for buyer ${bo.buyerBranchId.email} — order cancelled`);
            } else {
              retryIds.push(bo._id);
            }
          }

          // Cancel wale orders
          if (cancelIds.length > 0) {
            await BuyerOrder.updateMany(
              { _id: { $in: cancelIds } },
              { status: "cancelled" }
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

          // Retry wale orders — kal ki bidding mein
          if (retryIds.length > 0) {
            await BulkOrder.findByIdAndUpdate(bulkOrder._id, {
              retryCount:    bulkOrder.retryCount + 1,
              bidDate:       tomorrow,
              biddingEndsAt: nextBiddingEndsAt,
              buyerOrderIds: retryIds, // sirf retry wale
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

            console.log(`🔄 Retry ${bulkOrder.retryCount + 1}/3 — ${retryIds.length} orders kal dobara`);
          } else {
            // Sab cancel ho gaye — BulkOrder bhi cancel
            await BulkOrder.findByIdAndUpdate(bulkOrder._id, { status: "cancelled" });
            console.log(`❌ Sab orders PDC exceed — BulkOrder cancelled`);
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

      const buyerOrders = await BuyerOrder.find({
        _id: { $in: bulkOrder.buyerOrderIds },
      }).populate("buyerBranchId");

      for (const bo of buyerOrders) {
        // ─── 3% commission supplier price mein add karo ─
        // Buyer ko sirf final price dikhta hai — koi breakdown nahi
        const priceWithCommission  = Math.round(winningBid.pricePerUnit * (1 + COMMISSION_RATE) * 100) / 100;
        const totalAmount          = Math.round(bo.quantity * priceWithCommission * 100) / 100;

        // Invoice ke liye alag breakdown (accounting ke liye)
        const rawTotal         = bo.quantity * winningBid.pricePerUnit;
        const commissionAmount = Math.round(rawTotal * 0.02 * 100) / 100;
        const deliveryAmount   = Math.round(rawTotal * 0.01 * 100) / 100;
        const totalFeeAmount   = commissionAmount + deliveryAmount;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        const count         = await Invoice.countDocuments();
        const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(count + 1).padStart(4, "0")}`;

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
          pricePerUnit:     winningBid.pricePerUnit,   // original — accounting
          totalAmount:      rawTotal,
          commissionAmount,
          deliveryAmount,
          totalFeeAmount,
          grandTotal:       totalAmount,               // 3% included
          deliveryCharge:   0,                         // baad mein add hoga
          amountDue:        totalAmount,
          dueDate,
          invoiceStatus:    "draft",
        });

        // Email — pricePerUnit mein 3% already hai
        await sendOrderWonEmail({
          toEmail:      bo.buyerBranchId.email,
          managerName:  bo.buyerBranchId.managerName,
          itemName:     platformItem?.name,
          country:      country?.name,
          quantity:     bo.quantity,
          unit:         platformItem?.unit,
          pricePerUnit: priceWithCommission,  // 3% baked in
          totalAmount,                         // quantity × priceWithCommission
        });

        await BuyerOrder.findByIdAndUpdate(bo._id, { status: "won" });
        console.log(`🧾 Invoice: ${invoiceNumber} | ${priceWithCommission} QAR/${platformItem?.unit}`);
      }

      console.log(`✅ Winner: ${winningBid.pricePerUnit} QAR | BulkOrder: ${bulkOrder._id}`);
    }
  } catch (err) {
    console.error("6PM Cron error:", err);
  }
}, { timezone: "Asia/Qatar" });