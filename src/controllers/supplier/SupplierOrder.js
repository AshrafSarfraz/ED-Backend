const BuyerOrder    = require("../../models/buyer/buyerOrder");
const BulkOrder     = require("../../models/BulkOrder");
const Invoice       = require("../../models/invoice");
const Branch        = require("../../models/Branch");
const Bid           = require("../../models/Bid");
const DeliveryOrder = require("../../models/riderCompany/orderDelivery");
const { getDeliverySettings, qatarTime, qatarNowParts } = require("../../cron/settingService");

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Get Won Orders
//  GET /api/supplier/orders/won
// ═══════════════════════════════════════════════════════
exports.getWonOrders = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }

    const bulkOrders = await BulkOrder.find({
      winnerSupplierId: req.branch._id,
      status:           { $in: ["awarded", "ready"] },
    })
      .populate("platformItemId", "name image unit")
      .populate("countryId", "name")
      .sort({ createdAt: -1 });

    const supplierBranch = await Branch.findById(req.branch._id).select("defaultPackingDays");

    const result = await Promise.all(
      bulkOrders.map(async (bulk) => {
        const buyerOrders = await BuyerOrder.find({
          _id: { $in: bulk.buyerOrderIds },
        }).populate("buyerBranchId", "managerName email phone");

        const invoices = await Invoice.find({
          bulkOrderId: bulk._id,
          invoiceType: "buyer",
        });

        const orderList = buyerOrders.map((bo) => {
          const inv = invoices.find(
            (i) => i.buyerOrderId.toString() === bo._id.toString()
          );
          return {
            buyerOrderId:  bo._id,
            invoiceNumber: inv?.invoiceNumber,
            buyerName:     bo.buyerBranchId?.managerName,
            buyerPhone:    bo.buyerBranchId?.phone,
            quantity:      bo.quantity,
            unit:          bulk.platformItemId?.unit,
            packedStatus:  bo.packedStatus || false,
            orderStatus:   bo.status,
          };
        });

        return {
          bulkOrderId:        bulk._id,
          item:               bulk.platformItemId?.name,
          image:              bulk.platformItemId?.image,
          country:            bulk.countryId?.name,
          unit:               bulk.platformItemId?.unit,
          totalQuantity:      bulk.totalQuantity,
          winningPrice:       bulk.winningPrice,
          status:             bulk.status,
          defaultPackingDays: supplierBranch?.defaultPackingDays || 2,
          totalOrders:        buyerOrders.length,
          packedCount:        orderList.filter((o) => o.packedStatus).length,
          orderList,
        };
      })
    );

    res.json({ success: true, total: result.length, data: result });
  } catch (err) {
    console.error("getWonOrders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Get Order History (saare won orders, har status)
//  GET /api/supplier/orders/history
// ═══════════════════════════════════════════════════════
exports.getOrderHistory = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }

    const bulkOrders = await BulkOrder.find({
      winnerSupplierId: req.branch._id,
      status:           { $in: ["awarded", "ready", "cancelled"] },
    })
      .populate("platformItemId", "name image unit")
      .populate("countryId", "name")
      .sort({ createdAt: -1 });

    const result = await Promise.all(
      bulkOrders.map(async (bulk) => {
        const buyerOrders = await BuyerOrder.find({
          _id: { $in: bulk.buyerOrderIds },
        });

        const counts = {
          won:              0,
          packed:           0,
          ready_for_pickup: 0,
          delivered:        0,
          returned:         0,
          return_requested: 0,
        };
        buyerOrders.forEach((bo) => {
          if (counts[bo.status] !== undefined) counts[bo.status] += 1;
        });

        const total     = buyerOrders.length;
        const delivered = counts.delivered;

        let displayStatus = "packing";
        if (bulk.status === "cancelled") {
          displayStatus = "cancelled";
        } else if (total > 0 && delivered === total) {
          displayStatus = "delivered";
        } else if (counts.returned > 0) {
          displayStatus = "returned";
        } else if (counts.return_requested > 0) {
          displayStatus = "return_requested";
        } else if (bulk.status === "ready") {
          displayStatus = "ready_for_pickup";
        } else if (total > 0 && counts.packed === total) {
          displayStatus = "packed";
        }

        const saleTotal = bulk.winningPrice
          ? Math.round(bulk.winningPrice * bulk.totalQuantity * 100) / 100
          : 0;

        return {
          bulkOrderId:    bulk._id,
          orderNumber:    `#ORD-${bulk._id.toString().slice(-6).toUpperCase()}`,
          item:           bulk.platformItemId?.name,
          image:          bulk.platformItemId?.image,
          country:        bulk.countryId?.name,
          unit:           bulk.platformItemId?.unit,
          totalQuantity:  bulk.totalQuantity,
          winningPrice:   bulk.winningPrice,
          saleTotal,
          totalBuyers:    total,
          deliveredCount: delivered,
          returnedCount:  counts.returned,
          displayStatus,
          bulkStatus:     bulk.status,
          readyAt:        bulk.readyAt || null,
          createdAt:      bulk.createdAt,
        };
      })
    );

    res.json({ success: true, total: result.length, data: result });
  } catch (err) {
    console.error("getOrderHistory error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Mark Individual Order Packed
//  PUT /api/supplier/orders/:buyerOrderId/pack
// ═══════════════════════════════════════════════════════
exports.markOrderPacked = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }

    const order = await BuyerOrder.findById(req.params.buyerOrderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    await BuyerOrder.findByIdAndUpdate(order._id, {
      packedStatus: true,
      status:       "packed",
    });

    res.json({ success: true, message: "Order marked as packed ✅" });
  } catch (err) {
    console.error("markOrderPacked error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Mark ALL Orders Packed
//  PUT /api/supplier/orders/:bulkOrderId/pack-all
// ═══════════════════════════════════════════════════════
exports.markAllPacked = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }

    const bulkOrder = await BulkOrder.findOne({
      _id:              req.params.bulkOrderId,
      winnerSupplierId: req.branch._id,
    });

    if (!bulkOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    await BuyerOrder.updateMany(
      { _id: { $in: bulkOrder.buyerOrderIds } },
      { packedStatus: true, status: "packed" }
    );

    res.json({ success: true, message: "All orders marked as packed ✅" });
  } catch (err) {
    console.error("markAllPacked error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Mark Ready for Pickup
//  PUT /api/supplier/orders/:bulkOrderId/ready
// ═══════════════════════════════════════════════════════
exports.markAllReady = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }

    const bulkOrder = await BulkOrder.findOne({
      _id:              req.params.bulkOrderId,
      winnerSupplierId: req.branch._id,
      status:           "awarded",
    })
      .populate("platformItemId", "name image unit")
      .populate("countryId", "name");

    if (!bulkOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const buyerOrders = await BuyerOrder.find({
      _id: { $in: bulkOrder.buyerOrderIds },
    }).populate("buyerBranchId", "managerName phone email address");

    const allPacked = buyerOrders.every((bo) => bo.packedStatus === true);
    if (!allPacked) {
      return res.status(400).json({ success: false, message: "All orders must be packed first" });
    }

    const supplierBranch = await Branch.findById(req.branch._id);
    const settings       = await getDeliverySettings();
    const now            = new Date();

    // ─── Supplier late? (12 PM ke baad ready kiya = late) ───
    const { hour } = qatarNowParts();
    const supplierLate = hour >= settings.SUPPLIER_READY_HOUR && hour < settings.PICKUP_END_HOUR
      ? false
      : hour >= settings.PICKUP_END_HOUR;

    // ─── Clock times (aaj ke) ───
    const pickupStart     = qatarTime(settings.PICKUP_START_HOUR, 0);                                  // 10 AM
    const pickupEnd       = qatarTime(settings.PICKUP_END_HOUR, 0);                                    // 12 PM
    const deliverDeadline = qatarTime(settings.DELIVER_DEADLINE_HOUR, settings.DELIVER_DEADLINE_MIN);  // 8 PM
    const graceDeadline   = qatarTime(settings.GRACE_HOUR, settings.GRACE_MIN);                        // 9 PM

    // BuyerOrders → ready_for_pickup
    await BuyerOrder.updateMany(
      { _id: { $in: bulkOrder.buyerOrderIds } },
      { status: "ready_for_pickup" }
    );

    // BulkOrder → ready + late info
    await BulkOrder.findByIdAndUpdate(bulkOrder._id, {
      status:     "ready",
      readyAt:    now,
      isLate:     supplierLate,
      lateReason: supplierLate ? "supplier_late_preparation" : null,
    });

    // ─── SUPPLIER LATE → 1% penalty supplier invoice se cut ───
    if (supplierLate) {
      const penaltyPercent = settings.LATE_PENALTY_PERCENT; // 1
      const supplierInvoices = await Invoice.find({
        bulkOrderId: bulkOrder._id,
        invoiceType: "supplier",
      });
      for (const inv of supplierInvoices) {
        const penalty  = Math.round(inv.grandTotal * (penaltyPercent / 100) * 100) / 100;
        const newTotal = Math.round((inv.grandTotal - penalty) * 100) / 100;
        await Invoice.findByIdAndUpdate(inv._id, {
          latePenaltyPercent: penaltyPercent,
          latePenaltyAmount:  penalty,
          grandTotal:         newTotal,
          amountDue:          newTotal,
          penaltyNote: `${penaltyPercent}% late delivery penalty deducted (QAR ${penalty}) — order prepared late`,
        });
      }
    }

    // Delivery stops (har buyer)
    const deliveries = buyerOrders.map((bo) => ({
      buyerOrderId:  bo._id,
      buyerBranchId: bo.buyerBranchId._id,
      buyerName:     bo.buyerBranchId.managerName,
      buyerPhone:    bo.buyerBranchId.phone,
      quantity:      bo.quantity,
      unit:          bulkOrder.platformItemId?.unit,
      deliveryAddress: bo.deliveryAddress,
      status:        "pending",
    }));

    // DeliveryOrder create — delivery company ise uthayegi
    const deliveryOrder = await DeliveryOrder.create({
      bulkOrderId:      bulkOrder._id,
      supplierBranchId: req.branch._id,
      item:             bulkOrder.platformItemId?.name,
      image:            bulkOrder.platformItemId?.image,
      country:          bulkOrder.countryId?.name,
      unit:             bulkOrder.platformItemId?.unit,
      totalQuantity:    bulkOrder.totalQuantity,
      pickupLocation: {
        lat:     supplierBranch?.warehouseAddress?.lat     || null,
        lng:     supplierBranch?.warehouseAddress?.lng     || null,
        address: supplierBranch?.warehouseAddress?.address || null,
      },
      supplierName:  supplierBranch?.managerName || null,
      supplierPhone: supplierBranch?.phone || null,
      deliveries,
      status:            "pending",
      readyAt:           now,
      supplierWasLate:   supplierLate,
      pickupWindowStart: pickupStart,
      pickupWindowEnd:   pickupEnd,
      deliverDeadline,   // 8 PM
      graceDeadline,     // 9 PM
    });

    res.json({
      success: true,
      message: supplierLate
        ? "Ready for pickup. Note: prepared late — 1% penalty applied to your invoice."
        : "All packed! Ready for rider pickup. ✅",
      data: { deliveryOrderId: deliveryOrder._id, supplierLate },
    });
  } catch (err) {
    console.error("markAllReady error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Bid History
//  GET /api/supplier/bids/my-bids  (ya jo route tumne diya)
// ═══════════════════════════════════════════════════════
exports.getBidHistory = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }

    const bids = await Bid.find({ supplierBranchId: req.branch._id })
      .populate({
        path:     "bulkOrderId",
        populate: [
          { path: "platformItemId", select: "name unit" },
          { path: "countryId",      select: "name" },
        ],
      })
      .sort({ createdAt: -1 });

    const result = bids
      .filter(bid => bid.bulkOrderId)
      .map((bid) => ({
        bidId:         bid._id,
        status:        bid.status,
        myPrice:       bid.pricePerUnit,
        item:          bid.bulkOrderId?.platformItemId?.name,
        unit:          bid.bulkOrderId?.platformItemId?.unit,
        country:       bid.bulkOrderId?.countryId?.name,
        totalQuantity: bid.bulkOrderId?.totalQuantity,
        winningPrice:  bid.bulkOrderId?.winningPrice,
        bidDate:       bid.createdAt,
      }));

    res.json({ success: true, total: result.length, data: result });
  } catch (err) {
    console.error("getBidHistory error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Handle Return
//  PUT /api/supplier/orders/:orderId/return
// ═══════════════════════════════════════════════════════
exports.handleReturn = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can handle returns" });
    }

    const { action } = req.body;
    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be accept or reject" });
    }

    const order = await BuyerOrder.findById(req.params.orderId);
    if (!order || order.status !== "return_requested") {
      return res.status(404).json({ success: false, message: "Return request not found" });
    }

    if (action === "accept") {
      await BuyerOrder.findByIdAndUpdate(order._id, { status: "returned" });

      await Invoice.findOneAndUpdate(
        { buyerOrderId: order._id, invoiceType: "buyer" },
        {
          deliveryStatus: "returned",
          paymentStatus:  "paid",
          amountDue:      0,
        }
      );

      return res.json({ success: true, message: "Return accepted ✅ PDC released." });
    }

    await BuyerOrder.findByIdAndUpdate(order._id, { status: "delivered" });
    await Invoice.findOneAndUpdate(
      { buyerOrderId: order._id, invoiceType: "buyer" },
      { deliveryStatus: "delivered" }
    );

    res.json({ success: true, message: "Return rejected" });
  } catch (err) {
    console.error("handleReturn error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


















// const BuyerOrder    = require("../../models/buyer/buyerOrder");
// const BulkOrder     = require("../../models/BulkOrder");
// const Invoice       = require("../../models/invoice");
// const Branch        = require("../../models/Branch");
// const Bid           = require("../../models/Bid");

// // ═══════════════════════════════════════════════════════
// //  SUPPLIER — Get Won Orders
// // ═══════════════════════════════════════════════════════
// exports.getWonOrders = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Supplier") {
//       return res.status(403).json({ success: false, message: "Only suppliers can access this" });
//     }

//     const bulkOrders = await BulkOrder.find({
//       winnerSupplierId: req.branch._id,
//       status:           { $in: ["awarded", "ready"] },
//     })
//       .populate("platformItemId", "name image unit")
//       .populate("countryId", "name")
//       .sort({ createdAt: -1 });

//     const supplierBranch = await Branch.findById(req.branch._id).select("defaultPackingDays");

//     const result = await Promise.all(
//       bulkOrders.map(async (bulk) => {
//         const buyerOrders = await BuyerOrder.find({
//           _id: { $in: bulk.buyerOrderIds },
//         }).populate("buyerBranchId", "managerName email phone");

//         const invoices = await Invoice.find({
//           bulkOrderId: bulk._id,
//           invoiceType: "buyer",
//         });

//         const orderList = buyerOrders.map((bo) => {
//           const inv = invoices.find(
//             (i) => i.buyerOrderId.toString() === bo._id.toString()
//           );
//           return {
//             buyerOrderId:  bo._id,
//             invoiceNumber: inv?.invoiceNumber,
//             buyerName:     bo.buyerBranchId?.managerName,
//             buyerPhone:    bo.buyerBranchId?.phone,
//             quantity:      bo.quantity,
//             unit:          bulk.platformItemId?.unit,
//             packedStatus:  bo.packedStatus || false,
//             orderStatus:   bo.status,
//           };
//         });

//         return {
//           bulkOrderId:        bulk._id,
//           item:               bulk.platformItemId?.name,
//           image:              bulk.platformItemId?.image,
//           country:            bulk.countryId?.name,
//           unit:               bulk.platformItemId?.unit,
//           totalQuantity:      bulk.totalQuantity,
//           winningPrice:       bulk.winningPrice,
//           status:             bulk.status,
//           defaultPackingDays: supplierBranch?.defaultPackingDays || 2,
//           totalOrders:        buyerOrders.length,
//           packedCount:        orderList.filter((o) => o.packedStatus).length,
//           orderList,
//         };
//       })
//     );

//     res.json({ success: true, total: result.length, data: result });
//   } catch (err) {
//     console.error("getWonOrders error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  SUPPLIER — Get Order History (saare won orders, har status)
// //  GET /api/supplier/orders/history
// //
// //  controllers/supplier/SupplierOrder.js me ADD karo (ye function)
// //  (BuyerOrder, BulkOrder, Invoice, Branch pehle se imported hain)
// // ═══════════════════════════════════════════════════════
// exports.getOrderHistory = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Supplier") {
//       return res.status(403).json({ success: false, message: "Only suppliers can access this" });
//     }

//     // Is supplier ke saare jeete hue bulk orders — HAR status
//     // (awarded = abhi pack karna, ready = dispatch, cancelled bhi)
//     const bulkOrders = await BulkOrder.find({
//       winnerSupplierId: req.branch._id,
//       status:           { $in: ["awarded", "ready", "cancelled"] },
//     })
//       .populate("platformItemId", "name image unit")
//       .populate("countryId", "name")
//       .sort({ createdAt: -1 });

//     const result = await Promise.all(
//       bulkOrders.map(async (bulk) => {
//         const buyerOrders = await BuyerOrder.find({
//           _id: { $in: bulk.buyerOrderIds },
//         });

//         // har buyer order ke status count
//         const counts = {
//           won:              0,
//           packed:           0,
//           ready_for_pickup: 0,
//           delivered:        0,
//           returned:         0,
//           return_requested: 0,
//         };
//         buyerOrders.forEach((bo) => {
//           if (counts[bo.status] !== undefined) counts[bo.status] += 1;
//         });

//         const total     = buyerOrders.length;
//         const delivered = counts.delivered;

//         // ─── overall display status ───
//         let displayStatus = "packing"; // default — abhi pack ho raha (won/awarded)
//         if (bulk.status === "cancelled") {
//           displayStatus = "cancelled";
//         } else if (total > 0 && delivered === total) {
//           displayStatus = "delivered";
//         } else if (counts.returned > 0) {
//           displayStatus = "returned";
//         } else if (counts.return_requested > 0) {
//           displayStatus = "return_requested";
//         } else if (bulk.status === "ready") {
//           displayStatus = "ready_for_pickup";
//         } else if (total > 0 && counts.packed === total) {
//           displayStatus = "packed";
//         }

//         const saleTotal = bulk.winningPrice
//           ? Math.round(bulk.winningPrice * bulk.totalQuantity * 100) / 100
//           : 0;

//         return {
//           bulkOrderId:    bulk._id,
//           orderNumber:    `#ORD-${bulk._id.toString().slice(-6).toUpperCase()}`,
//           item:           bulk.platformItemId?.name,
//           image:          bulk.platformItemId?.image,
//           country:        bulk.countryId?.name,
//           unit:           bulk.platformItemId?.unit,
//           totalQuantity:  bulk.totalQuantity,
//           winningPrice:   bulk.winningPrice,
//           saleTotal,                          // supplier ki kamai (poora rate)
//           totalBuyers:    total,
//           deliveredCount: delivered,
//           returnedCount:  counts.returned,
//           displayStatus,                      // packing/packed/ready_for_pickup/delivered/returned/cancelled
//           bulkStatus:     bulk.status,
//           readyAt:        bulk.readyAt || null,
//           createdAt:      bulk.createdAt,
//         };
//       })
//     );

//     res.json({ success: true, total: result.length, data: result });
//   } catch (err) {
//     console.error("getOrderHistory error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };




// // ═══════════════════════════════════════════════════════
// //  SUPPLIER — Mark Individual Order Packed
// // ═══════════════════════════════════════════════════════
// exports.markOrderPacked = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Supplier") {
//       return res.status(403).json({ success: false, message: "Only suppliers can access this" });
//     }

//     const order = await BuyerOrder.findById(req.params.buyerOrderId);
//     if (!order) {
//       return res.status(404).json({ success: false, message: "Order not found" });
//     }

//     await BuyerOrder.findByIdAndUpdate(order._id, {
//       packedStatus: true,
//       status:       "packed",
//     });

//     res.json({ success: true, message: "Order marked as packed ✅" });
//   } catch (err) {
//     console.error("markOrderPacked error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  SUPPLIER — Mark ALL Orders Packed
// // ═══════════════════════════════════════════════════════
// exports.markAllPacked = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Supplier") {
//       return res.status(403).json({ success: false, message: "Only suppliers can access this" });
//     }

//     const bulkOrder = await BulkOrder.findOne({
//       _id:              req.params.bulkOrderId,
//       winnerSupplierId: req.branch._id,
//     });

//     if (!bulkOrder) {
//       return res.status(404).json({ success: false, message: "Order not found" });
//     }

//     await BuyerOrder.updateMany(
//       { _id: { $in: bulkOrder.buyerOrderIds } },
//       { packedStatus: true, status: "packed" }
//     );

//     res.json({ success: true, message: "All orders marked as packed ✅" });
//   } catch (err) {
//     console.error("markAllPacked error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  SUPPLIER — Mark Ready for Pickup
// // ═══════════════════════════════════════════════════════
// exports.markAllReady = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Supplier") {
//       return res.status(403).json({ success: false, message: "Only suppliers can access this" });
//     }

//     const bulkOrder = await BulkOrder.findOne({
//       _id:              req.params.bulkOrderId,
//       winnerSupplierId: req.branch._id,
//       status:           "awarded",
//     })
//       .populate("platformItemId", "name image unit")
//       .populate("countryId", "name");

//     if (!bulkOrder) {
//       return res.status(404).json({ success: false, message: "Order not found" });
//     }

//     const buyerOrders = await BuyerOrder.find({
//       _id: { $in: bulkOrder.buyerOrderIds },
//     }).populate("buyerBranchId", "managerName phone email address");

//     const allPacked = buyerOrders.every((bo) => bo.packedStatus === true);
//     if (!allPacked) {
//       return res.status(400).json({ success: false, message: "All orders must be packed first" });
//     }

//     const supplierBranch = await Branch.findById(req.branch._id);
//     const settings       = await getDeliverySettings();
//     const now            = new Date();

//     // ─── Supplier ready deadline = AGLE din subah 10 baje (Qatar) ───
//     // Bidding 6 PM ko end hoti, supplier ko raat bhar + subah 10 baje tak time.
//     // Agar abhi (ready karne ka waqt) 10 AM ke baad hai aur same/agla din nikal gaya → late.
//     const { hour } = qatarNowParts();

//     // ready deadline: agar abhi subah 10 se pehle hai → aaj 10 baje; warna soch:
//     // simple rule — supplier ko 10 AM tak ready karna tha. Agar ready karte waqt
//     // Qatar time 10 baje (READY_HOUR) ke baad hai → supplier late.
//     const supplierLate = hour >= settings.SUPPLIER_READY_HOUR && hour < settings.PICKUP_END_HOUR
//       ? false   // 10–12 ke beech ready kiya = pickup window, on time maan lo
//       : hour >= settings.PICKUP_END_HOUR;  // 12 PM ke baad ready = late

//     // ─── Pickup window aur delivery deadline (aaj ke clock times) ───
//     const pickupStart      = qatarTime(settings.PICKUP_START_HOUR, 0);              // 10 AM
//     const pickupEnd        = qatarTime(settings.PICKUP_END_HOUR, 0);                // 12 PM
//     const deliverDeadline  = qatarTime(settings.DELIVER_DEADLINE_HOUR, settings.DELIVER_DEADLINE_MIN); // 8 PM
//     const graceDeadline    = qatarTime(settings.GRACE_HOUR, settings.GRACE_MIN);    // 9 PM

//     // BuyerOrders → ready_for_pickup
//     await BuyerOrder.updateMany(
//       { _id: { $in: bulkOrder.buyerOrderIds } },
//       { status: "ready_for_pickup" }
//     );

//     // BulkOrder → ready + supplier late info
//     await BulkOrder.findByIdAndUpdate(bulkOrder._id, {
//       status:     "ready",
//       readyAt:    now,
//       isLate:     supplierLate,
//       lateReason: supplierLate ? "supplier_late_preparation" : null,
//     });

//     // ─── SUPPLIER LATE → 1% penalty supplier invoice se cut ───
//     if (supplierLate) {
//       const penaltyPercent = settings.LATE_PENALTY_PERCENT; // 1
//       const supplierInvoices = await Invoice.find({
//         bulkOrderId: bulkOrder._id,
//         invoiceType: "supplier",
//       });
//       for (const inv of supplierInvoices) {
//         const penalty  = Math.round(inv.grandTotal * (penaltyPercent / 100) * 100) / 100;
//         const newTotal = Math.round((inv.grandTotal - penalty) * 100) / 100;
//         await Invoice.findByIdAndUpdate(inv._id, {
//           latePenaltyPercent: penaltyPercent,
//           latePenaltyAmount:  penalty,
//           grandTotal:         newTotal,
//           amountDue:          newTotal,
//           penaltyNote: `${penaltyPercent}% late delivery penalty deducted (QAR ${penalty}) — order prepared late`,
//         });
//       }
//     }

//     // Delivery stops
//     const deliveries = buyerOrders.map((bo) => ({
//       buyerOrderId:  bo._id,
//       buyerBranchId: bo.buyerBranchId._id,
//       buyerName:     bo.buyerBranchId.managerName,
//       buyerPhone:    bo.buyerBranchId.phone,
//       quantity:      bo.quantity,
//       unit:          bulkOrder.platformItemId?.unit,
//       deliveryAddress: bo.deliveryAddress,
//       status:        "pending",
//     }));

//     // DeliveryOrder create
//     const deliveryOrder = await DeliveryOrder.create({
//       bulkOrderId:      bulkOrder._id,
//       supplierBranchId: req.branch._id,
//       item:             bulkOrder.platformItemId?.name,
//       image:            bulkOrder.platformItemId?.image,
//       country:          bulkOrder.countryId?.name,
//       unit:             bulkOrder.platformItemId?.unit,
//       totalQuantity:    bulkOrder.totalQuantity,
//       pickupLocation: {
//         lat:     supplierBranch?.warehouseAddress?.lat     || null,
//         lng:     supplierBranch?.warehouseAddress?.lng     || null,
//         address: supplierBranch?.warehouseAddress?.address || null,
//       },
//       supplierName:  supplierBranch?.managerName || null,
//       supplierPhone: supplierBranch?.phone || null,
//       deliveries,
//       status:           "pending",
//       readyAt:          now,
//       supplierWasLate:  supplierLate,           // delivery order me bhi record
//       pickupWindowStart: pickupStart,
//       pickupWindowEnd:   pickupEnd,
//       deliverDeadline,                          // 8 PM
//       graceDeadline,                            // 9 PM
//     });

//     res.json({
//       success: true,
//       message: supplierLate
//         ? "Ready for pickup. Note: prepared late — 1% penalty applied to your invoice."
//         : "All packed! Ready for rider pickup. ✅",
//       data: { deliveryOrderId: deliveryOrder._id, supplierLate },
//     });
//   } catch (err) {
//     console.error("markAllReady error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  SUPPLIER — Bid History
// // ═══════════════════════════════════════════════════════
// exports.getBidHistory = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Supplier") {
//       return res.status(403).json({ success: false, message: "Only suppliers can access this" });
//     }

//     const bids = await Bid.find({ supplierBranchId: req.branch._id })
//       .populate({
//         path:     "bulkOrderId",
//         populate: [
//           { path: "platformItemId", select: "name unit" },
//           { path: "countryId",      select: "name" },
//         ],
//       })
//       .sort({ createdAt: -1 });

//     const result = bids
//       .filter(bid => bid.bulkOrderId)
//       .map((bid) => ({
//         bidId:         bid._id,
//         status:        bid.status,
//         myPrice:       bid.pricePerUnit,
//         item:          bid.bulkOrderId?.platformItemId?.name,
//         unit:          bid.bulkOrderId?.platformItemId?.unit,
//         country:       bid.bulkOrderId?.countryId?.name,
//         totalQuantity: bid.bulkOrderId?.totalQuantity,
//         winningPrice:  bid.bulkOrderId?.winningPrice,
//         bidDate:       bid.createdAt,
//       }));

//     res.json({ success: true, total: result.length, data: result });
//   } catch (err) {
//     console.error("getBidHistory error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  SUPPLIER — Handle Return
// // ═══════════════════════════════════════════════════════
// exports.handleReturn = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Supplier") {
//       return res.status(403).json({ success: false, message: "Only suppliers can handle returns" });
//     }

//     const { action } = req.body;
//     if (!["accept", "reject"].includes(action)) {
//       return res.status(400).json({ success: false, message: "action must be accept or reject" });
//     }

//     const order = await BuyerOrder.findById(req.params.orderId);
//     if (!order || order.status !== "return_requested") {
//       return res.status(404).json({ success: false, message: "Return request not found" });
//     }

//     if (action === "accept") {
//       await BuyerOrder.findByIdAndUpdate(order._id, { status: "returned" });

//       await Invoice.findOneAndUpdate(
//         { buyerOrderId: order._id, invoiceType: "buyer" },
//         {
//           deliveryStatus: "returned",
//           paymentStatus:  "paid",
//           amountDue:      0,
//         }
//       );

//       return res.json({ success: true, message: "Return accepted ✅ PDC released." });
//     }

//     await BuyerOrder.findByIdAndUpdate(order._id, { status: "delivered" });
//     await Invoice.findOneAndUpdate(
//       { buyerOrderId: order._id, invoiceType: "buyer" },
//       { deliveryStatus: "delivered" }
//     );

//     res.json({ success: true, message: "Return rejected" });
//   } catch (err) {
//     console.error("handleReturn error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };


