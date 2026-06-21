const BuyerOrder    = require("../../models/buyer/buyerOrder");
const BulkOrder     = require("../../models/BulkOrder");
const Invoice       = require("../../models/invoice");
const Branch        = require("../../models/Branch");
const Bid           = require("../../models/Bid");
const DeliveryOrder = require("../../models/riderCompany/orderDelivery");

// ─── Fixed clock settings (Qatar time) — future me change ───
const DELIVERY_CONFIG = {
  PICKUP_START_HOUR:     10,   // 10 AM
  PICKUP_END_HOUR:       12,   // 12 PM — iske baad ready = late
  DELIVER_DEADLINE_HOUR: 20,   // 8 PM
  GRACE_HOUR:            21,   // 9 PM
};

// Qatar (UTC+3) abhi ke parts
const _qatarParts = () => {
  const q = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return { year: q.getUTCFullYear(), month: q.getUTCMonth(), day: q.getUTCDate(), hour: q.getUTCHours() };
};

// Qatar aaj ke hour:min → asli UTC Date
const _qatarTime = (hour, min = 0) => {
  const { year, month, day } = _qatarParts();
  return new Date(Date.UTC(year, month, day, hour, min, 0, 0) - 3 * 60 * 60 * 1000);
};

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
          isLate:             bulk.isLate || false,
          lateReason:         bulk.lateReason || null,
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
//  (Penalty ka PAISA abhi cut NAHI — sirf late FLAG. Payment side pe cut karenge)
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
      return res.status(404).json({ success: false, message: "Order not found or already ready" });
    }

    const buyerOrders = await BuyerOrder.find({
      _id: { $in: bulkOrder.buyerOrderIds },
    }).populate("buyerBranchId", "managerName phone email address");

    const allPacked = buyerOrders.every((bo) => bo.packedStatus === true);
    if (!allPacked) {
      return res.status(400).json({ success: false, message: "All orders must be packed first" });
    }

    const supplierBranch = await Branch.findById(req.branch._id);
    const now = new Date();

    // ─── Supplier late? (12 PM ke baad ready = late) — SIRF FLAG ───
    const { hour } = _qatarParts();
    const supplierLate = hour >= DELIVERY_CONFIG.PICKUP_END_HOUR;

    // ─── Clock deadlines (aaj ke) ───
    const pickupStart     = _qatarTime(DELIVERY_CONFIG.PICKUP_START_HOUR, 0); // 10 AM
    const pickupEnd       = _qatarTime(DELIVERY_CONFIG.PICKUP_END_HOUR, 0);   // 12 PM
    const deliverDeadline = _qatarTime(DELIVERY_CONFIG.DELIVER_DEADLINE_HOUR, 0); // 8 PM
    const graceDeadline   = _qatarTime(DELIVERY_CONFIG.GRACE_HOUR, 0);        // 9 PM

    // BuyerOrders → ready_for_pickup
    await BuyerOrder.updateMany(
      { _id: { $in: bulkOrder.buyerOrderIds } },
      { status: "ready_for_pickup" }
    );

    // BulkOrder → ready + late FLAG (paisa cut nahi)
    await BulkOrder.findByIdAndUpdate(bulkOrder._id, {
      status:     "ready",
      readyAt:    now,
      isLate:     supplierLate,
      lateReason: supplierLate ? "supplier_late_preparation" : null,
    });

    // NOTE: 1% penalty ka paisa abhi cut NAHI kar rahe.
    // Payment side pe BulkOrder.isLate / DeliveryOrder.supplierWasLate dekh ke cut karenge.

    // ─── Delivery stops ───
    const deliveries = buyerOrders.map((bo) => ({
      buyerOrderId:  bo._id,
      buyerBranchId: bo.buyerBranchId?._id,
      buyerName:     bo.buyerBranchId?.managerName,
      buyerPhone:    bo.buyerBranchId?.phone,
      quantity:      bo.quantity,
      unit:          bulkOrder.platformItemId?.unit,
      deliveryAddress: bo.deliveryAddress,
      status:        "pending",
    }));

    // ─── DeliveryOrder create ───
    const deliveryOrder = await DeliveryOrder.create({
      bulkOrderId:       bulkOrder._id,
      supplierBranchId:  req.branch._id,
      item:              bulkOrder.platformItemId?.name,
      image:             bulkOrder.platformItemId?.image,
      country:           bulkOrder.countryId?.name,
      unit:              bulkOrder.platformItemId?.unit,
      totalQuantity:     bulkOrder.totalQuantity,
      pickupLocation: {
        lat:     supplierBranch?.address?.lat     || null,
        lng:     supplierBranch?.address?.lng     || null,
        address: supplierBranch?.address?.address || null,
      },
      supplierName:      supplierBranch?.managerName || null,
      supplierPhone:     supplierBranch?.phone || null,
      deliveries,
      status:            "pending",
      readyAt:           now,
      supplierWasLate:   supplierLate,   // payment ke waqt kaam aayega
      pickupWindowStart: pickupStart,
      pickupWindowEnd:   pickupEnd,
      deliverDeadline,   // 8 PM
      graceDeadline,     // 9 PM
    });

    res.json({
      success: true,
      message: supplierLate
        ? "Ready for pickup. Note: you prepared this late — it may affect your payment."
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
//  SUPPLIER — Order Delivery Tracking
//  GET /api/supplier/orders/:bulkOrderId/tracking
//
//  controllers/supplier/SupplierOrder.js me ADD karo (ye function)
//  (BulkOrder, BuyerOrder, DeliveryOrder pehle se imported hain)
//
//  Route (history wale ke paas):
//    router.get("/:bulkOrderId/tracking", protectBranch, getSupplierTracking);
// ═══════════════════════════════════════════════════════
exports.getBuyerOrderTracking = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }
 
    const buyerOrder = await BuyerOrder.findById(req.params.buyerOrderId);
    if (!buyerOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
 
    // Bulk order (ye supplier ka hi hona chahiye)
    const bulk = await BulkOrder.findOne({
      _id:              buyerOrder.bulkOrderId,
      winnerSupplierId: req.branch._id,
    })
      .populate("platformItemId", "name image unit")
      .populate("countryId", "name");
 
    if (!bulk) {
      return res.status(403).json({ success: false, message: "Not your order" });
    }
 
    // Delivery order + is buyer ka stop
    const delivery = await DeliveryOrder.findOne({ bulkOrderId: bulk._id });
    const stop = delivery?.deliveries?.find(
      (d) => d.buyerOrderId.toString() === buyerOrder._id.toString()
    );
 
    // ─── Is buyer ki apni journey ───
    // status: won/awarded → preparing | packed | ready_for_pickup(dispatched) | delivered
    const boStatus = buyerOrder.status;
 
    const stepDefs = [
      { key: "preparing",  title: "Preparing",       sub: "Supplier is packing this order" },
      { key: "packed",     title: "Packed",          sub: "This order has been packed" },
      { key: "dispatched", title: "Dispatched",      sub: "Handed to delivery for pickup" },
      { key: "transit",    title: "Out for Delivery",sub: "On the way to the buyer" },
      { key: "delivered",  title: "Delivered",       sub: "Buyer received this order" },
    ];
 
    // current step nikalo (is buyer ke status se)
    let currentStep = 0;
    if (boStatus === "delivered")                         currentStep = 4;
    else if (delivery?.status === "out_for_delivery")     currentStep = 3;
    else if (delivery?.status === "picked")               currentStep = 3;
    else if (boStatus === "ready_for_pickup")             currentStep = 2;
    else if (boStatus === "packed")                       currentStep = 1;
    else                                                  currentStep = 0; // won/awarded
 
    // stop delivered? to delivered pakka
    if (stop?.status === "delivered") currentStep = 4;
 
    const stepTimes = {
      preparing:  bulk.createdAt || null,
      packed:     null,
      dispatched: delivery?.readyAt || bulk.readyAt || null,
      transit:    delivery?.pickedAt || null,
      delivered:  stop?.deliveredAt || null,
    };
 
    const steps = stepDefs.map((s, idx) => ({
      key:   s.key,
      title: s.title,
      sub:   s.sub,
      done:  idx <= currentStep,
      time:  stepTimes[s.key] || null,
    }));
 
    const progressPercent = Math.round((currentStep / (stepDefs.length - 1)) * 100);
 
    // late? (sirf is order ke liye relevant — delivery late ya supplier late)
    const isLate = delivery?.isLate || bulk.isLate || false;
    const lateBy = delivery?.lateBy || (bulk.isLate ? "supplier" : "none");
 
    res.json({
      success: true,
      data: {
        buyerOrderId:   buyerOrder._id,
        orderNumber:    `#ORD-${buyerOrder._id.toString().slice(-6).toUpperCase()}`,
        item:           bulk.platformItemId?.name,
        image:          bulk.platformItemId?.image,
        country:        bulk.countryId?.name,
        unit:           bulk.platformItemId?.unit,
        quantity:       buyerOrder.quantity,
 
        status:         boStatus,
        currentStep,
        progressPercent,
        steps,
 
        isLate,
        lateBy,
        deliverDeadline: delivery?.deliverDeadline || null,
 
        deliveryAddress: buyerOrder.deliveryAddress || null,
        deliveredAt:     stop?.deliveredAt || null,
      },
    });
  } catch (err) {
    console.error("getBuyerOrderTracking error:", err);
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




// ═══════════════════════════════════════════════════════
//  SUPPLIER — Payment Summary (Date wise grouped)
//  GET /api/payments/supplier/summary
// ═══════════════════════════════════════════════════════
exports.supplierPaymentSummary = async (req, res) => {
  try {
    if (req.branch.accountType !== "Supplier") {
      return res.status(403).json({ success: false, message: "Only suppliers can access this" });
    }

    const invoices = await Invoice.find({
      supplierBranchId: req.branch._id,
      invoiceType:      "supplier",
    })
      .populate("platformItemId", "name image unit")
      .populate("countryId",      "name")
      .populate("bulkOrderId",    "totalQuantity winningPrice status")
      .populate("buyerBranchId",  "managerName companyName")
      .sort({ createdAt: -1 });

    // ─── Step 1: Bulk order wise group ───
    const bulkMap = {};

    invoices.forEach((inv) => {
      const bulkId = inv.bulkOrderId?._id?.toString() || "unknown";

      if (!bulkMap[bulkId]) {
        bulkMap[bulkId] = {
          bulkOrderId:   inv.bulkOrderId?._id,
          orderNumber:   `#ORD-${bulkId.slice(-6).toUpperCase()}`,
          item:          inv.platformItemId?.name,
          image:         inv.platformItemId?.image,
          country:       inv.countryId?.name,
          unit:          inv.platformItemId?.unit,
          totalQuantity: inv.bulkOrderId?.totalQuantity,
          winningPrice:  inv.bulkOrderId?.winningPrice,
          createdAt:     inv.createdAt,
          // date key for grouping
          dateKey:       new Date(inv.createdAt).toISOString().slice(0, 10),
          buyers:        [],
          totalEarning:  0,
          totalReleased: 0,
          totalPending:  0,
        };
      }

      const released = inv.supplierPaymentStatus === "released";
      const amount   = Math.round(inv.grandTotal * 100) / 100;

      bulkMap[bulkId].buyers.push({
        buyerName: inv.buyerBranchId?.managerName,
        quantity:  inv.quantity,
        amount,
        released,
      });

      bulkMap[bulkId].totalEarning += amount;
      if (released) bulkMap[bulkId].totalReleased += amount;
      else          bulkMap[bulkId].totalPending  += amount;
    });

    // ─── Step 2: Date wise group karo ───
    const dateMap = {};

    Object.values(bulkMap).forEach((bulk) => {
      const dk = bulk.dateKey;
      if (!dateMap[dk]) {
        dateMap[dk] = {
          date:          dk,
          dateLabel:     new Date(dk).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          bulkOrders:    [],
          dayEarning:    0,
          dayReleased:   0,
          dayPending:    0,
        };
      }

      const b = {
        ...bulk,
        totalEarning:  Math.round(bulk.totalEarning  * 100) / 100,
        totalReleased: Math.round(bulk.totalReleased * 100) / 100,
        totalPending:  Math.round(bulk.totalPending  * 100) / 100,
        buyersCount:   bulk.buyers.length,
        paidCount:     bulk.buyers.filter((x) => x.released).length,
        allPaid:       bulk.buyers.every((x) => x.released),
      };

      dateMap[dk].bulkOrders.push(b);
      dateMap[dk].dayEarning  += b.totalEarning;
      dateMap[dk].dayReleased += b.totalReleased;
      dateMap[dk].dayPending  += b.totalPending;
    });

    // ─── Step 3: Sort dates latest first ───
    const result = Object.values(dateMap)
      .map((d) => ({
        ...d,
        dayEarning:  Math.round(d.dayEarning  * 100) / 100,
        dayReleased: Math.round(d.dayReleased * 100) / 100,
        dayPending:  Math.round(d.dayPending  * 100) / 100,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // ─── Overall summary ───
    const overall = {
      totalEarning:  Math.round(result.reduce((s, r) => s + r.dayEarning,  0) * 100) / 100,
      totalReleased: Math.round(result.reduce((s, r) => s + r.dayReleased, 0) * 100) / 100,
      totalPending:  Math.round(result.reduce((s, r) => s + r.dayPending,  0) * 100) / 100,
    };

    res.json({ success: true, overall, total: result.length, data: result });
  } catch (err) {
    console.error("supplierPaymentSummary error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};