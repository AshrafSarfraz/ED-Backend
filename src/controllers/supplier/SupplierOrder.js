const BuyerOrder    = require("../../models/buyer/buyerOrder");
const BulkOrder     = require("../../models/BulkOrder");
const Invoice       = require("../../models/invoice");
const DeliveryOrder = require("../../models/rider/deliveryOrder");
const Branch        = require("../../models/Branch");
const Bid           = require("../../models/Bid");

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Get Won Orders
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
//  SUPPLIER — Mark Individual Order Packed
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
    });

    if (!bulkOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const buyerOrders = await BuyerOrder.find({
      _id: { $in: bulkOrder.buyerOrderIds },
    }).populate("buyerBranchId", "managerName phone email address");

    const allPacked = buyerOrders.every((bo) => bo.packedStatus === true);
    if (!allPacked) {
      return res.status(400).json({
        success: false,
        message: "All orders must be packed first",
      });
    }

    const supplierBranch = await Branch.findById(req.branch._id);

    // BuyerOrders → ready_for_pickup
    await BuyerOrder.updateMany(
      { _id: { $in: bulkOrder.buyerOrderIds } },
      { status: "ready_for_pickup" }
    );

    // BulkOrder → ready
    await BulkOrder.findByIdAndUpdate(bulkOrder._id, {
      status:  "ready",
      readyAt: new Date(),
      isLate:  false,
    });

    // DeliveryOrder create
    const deliveries = buyerOrders.map((bo) => ({
      buyerOrderId:    bo._id,
      buyerBranchId:   bo.buyerBranchId._id,
      buyerName:       bo.buyerBranchId.managerName,
      buyerPhone:      bo.buyerBranchId.phone,
      deliveryAddress: bo.deliveryAddress,
      status:          "pending",
    }));

    await DeliveryOrder.create({
      bulkOrderId: bulkOrder._id,
      pickupLocation: {
        lat:     supplierBranch?.warehouseAddress?.lat     || null,
        lng:     supplierBranch?.warehouseAddress?.lng     || null,
        address: supplierBranch?.warehouseAddress?.address || null,
      },
      deliveries,
      status: "pending",
    });

    res.json({
      success: true,
      message: "All packed! Ready for rider pickup. ✅",
    });
  } catch (err) {
    console.error("markAllReady error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  SUPPLIER — Bid History
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
// const DeliveryOrder = require("../../models/rider/deliveryOrder");
// const DeliverySlab  = require("../../models/rider/deliverySlab");
// const Branch        = require("../../models/branch");
// const Bid           = require("../../models/Bid");
// const axios         = require("axios");
// const { sendFinalInvoiceEmail } = require("../../utils/sendEmail");

// // ═══════════════════════════════════════════════════════
// //  SUPPLIER — Get Won Orders
// //  GET /api/supplier/orders/won
// // ═══════════════════════════════════════════════════════
// exports.getWonOrders = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Supplier") {
//       return res.status(403).json({ success: false, message: "Only suppliers can access this" });
//     }

//     const bulkOrders = await BulkOrder.find({
//       winnerSupplierId: req.branch._id,
//       status: { $in: ["awarded", "ready"] },
//     })
//       .populate("platformItemId", "name image unit")
//       .populate("countryId", "name")
//       .sort({ createdAt: -1 });

//     const result = await Promise.all(
//       bulkOrders.map(async (bulk) => {
//         const buyerOrders = await BuyerOrder.find({
//           _id: { $in: bulk.buyerOrderIds },
//         }).populate("buyerBranchId", "managerName email phone");

//         const invoices = await Invoice.find({ bulkOrderId: bulk._id });

//         const orderList = buyerOrders.map((bo) => {
//           const inv = invoices.find(
//             (i) => i.buyerOrderId.toString() === bo._id.toString()
//           );
//           return {
//             buyerOrderId:  bo._id,
//             invoiceNumber: inv?.invoiceNumber,
//             buyerName:     bo.buyerBranchId?.managerName,
//             buyerPhone:    bo.buyerBranchId?.phone,
//             buyerEmail:    bo.buyerBranchId?.email,
//             quantity:      bo.quantity,
//             unit:          bulk.platformItemId?.unit,
//             packedStatus:  bo.packedStatus || false,
//           };
//         });

//         return {
//           bulkOrderId:   bulk._id,
//           item:          bulk.platformItemId?.name,
//           image:         bulk.platformItemId?.image,
//           country:       bulk.countryId?.name,
//           unit:          bulk.platformItemId?.unit,
//           totalQuantity: bulk.totalQuantity,
//           winningPrice:  bulk.winningPrice,
//           status:        bulk.status,
//           estimatedDays: bulk.estimatedDays,
//           totalOrders:   buyerOrders.length,
//           packedCount:   orderList.filter((o) => o.packedStatus).length,
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
// //  SUPPLIER — Mark Individual Order Packed
// //  PUT /api/supplier/orders/:buyerOrderId/pack
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

//     await BuyerOrder.findByIdAndUpdate(order._id, { packedStatus: true });
//     res.json({ success: true, message: "Order marked as packed ✅" });
//   } catch (err) {
//     console.error("markOrderPacked error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  SUPPLIER — Mark All Ready + Notify Rider
// //  PUT /api/supplier/orders/:bulkOrderId/ready
// // ═══════════════════════════════════════════════════════
// exports.markAllReady = async (req, res) => {
//   try {
//     if (req.branch.accountType !== "Supplier") {
//       return res.status(403).json({ success: false, message: "Only suppliers can access this" });
//     }

//     const { estimatedDays } = req.body;
//     if (!estimatedDays || estimatedDays < 1 || estimatedDays > 4) {
//       return res.status(400).json({
//         success: false,
//         message: "estimatedDays must be between 1 and 4",
//       });
//     }

//     const bulkOrder = await BulkOrder.findOne({
//       _id:              req.params.bulkOrderId,
//       winnerSupplierId: req.branch._id,
//       status:           "awarded",
//     });

//     if (!bulkOrder) {
//       return res.status(404).json({ success: false, message: "Order not found" });
//     }

//     // Sab orders packed check
//     const buyerOrders = await BuyerOrder.find({
//       _id: { $in: bulkOrder.buyerOrderIds },
//     }).populate("buyerBranchId");

//     const allPacked = buyerOrders.every((bo) => bo.packedStatus === true);
//     if (!allPacked) {
//       return res.status(400).json({
//         success: false,
//         message: "All orders must be packed first",
//       });
//     }

//     // Supplier warehouse check
//     const supplierBranch = await Branch.findById(req.branch._id);
//     if (!supplierBranch?.warehouseAddress?.lat) {
//       return res.status(400).json({
//         success: false,
//         message: "Please update your warehouse location first",
//       });
//     }

//     // Rider Company
//     const riderCompany = await RiderCompany.findOne({ isActive: true });
//     if (!riderCompany) {
//       return res.status(400).json({ success: false, message: "No rider company available" });
//     }

//     // Har buyer ke liye distance + charge
//     const deliveries = [];
//     for (const bo of buyerOrders) {
//       const deliveryAddr = bo.deliveryAddress;
//       let distanceKm     = 0;
//       let deliveryCharge = 0;

//       if (deliveryAddr?.lat && deliveryAddr?.lng) {
//         try {
//           const googleRes = await axios.get(
//             `https://maps.googleapis.com/maps/api/distancematrix/json`,
//             {
//               params: {
//                 origins:      `${supplierBranch.warehouseAddress.lat},${supplierBranch.warehouseAddress.lng}`,
//                 destinations: `${deliveryAddr.lat},${deliveryAddr.lng}`,
//                 key:          process.env.GOOGLE_MAPS_API_KEY,
//               },
//             }
//           );

//           const element = googleRes.data.rows[0]?.elements[0];
//           if (element?.status === "OK") {
//             distanceKm = element.distance.value / 1000;
//           }
//         } catch (e) {
//           console.error("Google Maps error:", e.message);
//         }

//         // Slab rate
//         const slab = await DeliverySlab.findOne({
//           minKm:    { $lte: distanceKm },
//           maxKm:    { $gt:  distanceKm },
//           isActive: true,
//         });

//         const ratePerKm = slab?.ratePerKm || 1;
//         deliveryCharge  = Math.round(distanceKm * ratePerKm * 100) / 100;
//       }

//       // Invoice final update
//       const invoice = await Invoice.findOne({ buyerOrderId: bo._id });
//       if (invoice) {
//         const grandTotal = invoice.totalAmount + deliveryCharge;
//         await Invoice.findByIdAndUpdate(invoice._id, {
//           deliveryCharge,
//           grandTotal,
//           amountDue:     grandTotal,
//           invoiceStatus: "final",
//         });

//         // Final invoice email
//         await sendFinalInvoiceEmail({
//           toEmail:       bo.buyerBranchId.email,
//           managerName:   bo.buyerBranchId.managerName,
//           invoiceNumber: invoice.invoiceNumber,
//           itemName:      invoice.unit,
//           quantity:      invoice.quantity,
//           unit:          invoice.unit,
//           pricePerUnit:  invoice.pricePerUnit,
//           totalAmount:   invoice.totalAmount,
//           deliveryCharge,
//           grandTotal,
//           dueDate:       invoice.dueDate,
//         });
//       }

//       deliveries.push({
//         buyerOrderId:    bo._id,
//         buyerBranchId:   bo.buyerBranchId._id,
//         buyerName:       bo.buyerBranchId.managerName,
//         buyerPhone:      bo.buyerBranchId.phone,
//         deliveryAddress: deliveryAddr,
//         distanceKm,
//         deliveryCharge,
//         status:          "pending",
//       });
//     }

//     // DeliveryOrder banao
//     const deliveryOrder = await DeliveryOrder.create({
//       bulkOrderId:    bulkOrder._id,
//       riderCompanyId: riderCompany._id,
//       pickupLocation: {
//         lat:     supplierBranch.warehouseAddress.lat,
//         lng:     supplierBranch.warehouseAddress.lng,
//         address: supplierBranch.warehouseAddress.address,
//       },
//       deliveries,
//       status: "pending",
//     });

//     // BulkOrder ready
//     await BulkOrder.findByIdAndUpdate(bulkOrder._id, {
//       status:        "ready",
//       estimatedDays,
//       readyAt:       new Date(),
//     });

//     console.log(`📦 DeliveryOrder created: ${deliveryOrder._id}`);

//     res.json({
//       success: true,
//       message: `All packed! Rider company notified. Estimated delivery: ${estimatedDays} day(s)`,
//     });
//   } catch (err) {
//     console.error("markAllReady error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  SUPPLIER — Bid History
// //  GET /api/supplier/orders/bid-history
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

//     const result = bids.map((bid) => ({
//       bidId:         bid._id,
//       status:        bid.status,
//       myPrice:       bid.pricePerUnit,
//       item:          bid.bulkOrderId?.platformItemId?.name,
//       unit:          bid.bulkOrderId?.platformItemId?.unit,
//       country:       bid.bulkOrderId?.countryId?.name,
//       totalQuantity: bid.bulkOrderId?.totalQuantity,
//       winningPrice:  bid.bulkOrderId?.winningPrice,
//       bidDate:       bid.createdAt,
//     }));

//     res.json({ success: true, total: result.length, data: result });
//   } catch (err) {
//     console.error("getBidHistory error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // ═══════════════════════════════════════════════════════
// //  SUPPLIER — Handle Return
// //  PUT /api/supplier/orders/:orderId/return
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
//         { buyerOrderId: order._id },
//         { deliveryStatus: "returned", paymentStatus: "unpaid" }
//       );
//       return res.json({ success: true, message: "Return accepted ✅" });
//     }

//     await BuyerOrder.findByIdAndUpdate(order._id, { status: "delivered" });
//     await Invoice.findOneAndUpdate(
//       { buyerOrderId: order._id },
//       { deliveryStatus: "delivered" }
//     );
//     res.json({ success: true, message: "Return rejected" });
//   } catch (err) {
//     console.error("handleReturn error:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };