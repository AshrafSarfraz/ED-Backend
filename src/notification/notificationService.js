// 📁 services/notificationService.js
// ═══════════════════════════════════════════════════════
//  Push notifications (Firebase Cloud Messaging).
//
//  Saare push YAHAN se jaate hain — koi controller ya cron directly
//  admin.messaging() call nahi karta.
//
//  Notifications DB me save NAHI hoti — sirf mobile pe popup jaata hai.
//
//  4 triggers:
//    1. notifyBiddingResult   → Buyer   (bidding khatam — won + cancelled combined)
//    2. notifyOrderDelivered  → Buyer   (uska order deliver ho gaya)
//       notifyBulkDelivered   → Supplier(bulk order ki saari delivery complete)
//    3. notifyReturnRequest   → Supplier(buyer ne return maanga)
//    4. notifyBiddingStarted  → Supplier(nayi bidding khuli jisme wo bid kar sakta hai)
//    5. notifyOutbid          → Supplier(uski lead chheen li gayi — real-time)
//    6. notifyBiddingClosingSoon → Supplier(bidding band hone se 10 min pehle)
// ═══════════════════════════════════════════════════════
const Branch = require("../models/Branch");

// ─────────────────────────────────────────────────────────
//  📱 MOBILE SCREEN NAMES — sirf YAHAN badalne hain
//
//  App tap pe `data.screen` dekh ke navigate karti hai.
//  React Native me screen ke naam alag hon to bas yeh object update karein,
//  poori file me kahin aur change karne ki zaroorat nahi.
// ─────────────────────────────────────────────────────────
const SCREENS = {
  BUYER_ORDERS:       "BuyerOrder",         // buyer ki order list (tabs ke saath)
  BUYER_ORDER_DETAIL: "BuyerOrderDetail",   // ek order ki detail
  SUPPLIER_BIDDING:   "SupplierBidding",    // supplier ki active bidding list
  SUPPLIER_ORDERS:    "SupplierWonBuyers",  // supplier ke jeete hue orders
  SUPPLIER_RETURNS:   "SupplierReturns",    // supplier ke return requests
};

// firebaseAdmin ko LAZY require karte hain — file load hote waqt nahi.
// Wajah: firebaseAdmin.js module load pe hi FIREBASE_PRIVATE_KEY.replace() chalata hai.
// Env missing ho to poora require chain phat jata hai — aur is service ko cron
// import karta hai, jise settings controllers import karte hain.
// Lazy karne se firebase sirf tab load hota hai jab actually push bhejni ho.
let _admin = null;
const getAdmin = () => {
  if (!_admin) _admin = require("../config/firebaseAdmin").admin;
  return _admin;
};

// FCM ki `data` payload me HAR value string honi chahiye —
// number ya boolean bhejne pe FCM error deta hai.
const stringifyData = (data = {}) => {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    out[k] = String(v);
  }
  return out;
};

// In error codes ka matlab: token mar chuka hai (app uninstall / reinstall / purana build)
const DEAD_TOKEN_ERRORS = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
];

// ═══════════════════════════════════════════════════════
//  CORE — ek branch ko push bhejo (uske saare devices pe)
// ═══════════════════════════════════════════════════════
/**
 * @param {ObjectId|string} branchId
 * @param {object}   payload
 * @param {string}   payload.title
 * @param {string}   payload.body
 * @param {object}   [payload.data]  - tap pe navigate karne ke liye
 * @param {string[]} [tokens]        - tokens paas hon to DB query bach jaati hai
 * @returns {Promise<{sent:number, failed:number, dead:string[]}>}
 */
async function sendToBranch(branchId, { title, body, data = {} }, tokens = null) {
  try {
    if (!branchId) return { sent: 0, failed: 0, dead: [], skipped: true };

    let fcmTokens = tokens;
    if (!fcmTokens) {
      const branch = await Branch.findById(branchId).select("fcmTokens");
      fcmTokens = branch?.fcmTokens || [];
    }

    // duplicate aur khaali hataao
    fcmTokens = [...new Set((fcmTokens || []).filter(Boolean))];

    // App install nahi hai ya logout hai — koi push nahi, koi error nahi
    if (fcmTokens.length === 0) return { sent: 0, failed: 0, dead: [], skipped: true };

    const res = await getAdmin().messaging().sendEachForMulticast({
      tokens: fcmTokens,
      notification: { title, body },
      data: stringifyData(data),
      android: {
        priority: "high",
        notification: { sound: "default", channelId: "default" },
      },
      apns: {
        payload: { aps: { sound: "default", badge: 1 } },
      },
    });

    // ─── Mare hue tokens DB se hata do ───────────────────
    const dead = [];
    res.responses.forEach((r, i) => {
      if (!r.success && DEAD_TOKEN_ERRORS.includes(r.error?.code)) dead.push(fcmTokens[i]);
    });

    if (dead.length > 0) {
      await Branch.findByIdAndUpdate(branchId, { $pull: { fcmTokens: { $in: dead } } });
      console.log(`🧹 ${dead.length} dead FCM token(s) removed — branch ${branchId}`);
    }

    console.log(`🔔 Push → branch ${branchId}: ${res.successCount} sent, ${res.failureCount} failed`);
    return { sent: res.successCount, failed: res.failureCount, dead };
  } catch (err) {
    // Push fail hona kabhi caller ko na toray — sirf log karo
    console.error("Push notification error:", err.message);
    return { sent: 0, failed: 0, dead: [], error: err.message };
  }
}

// ═══════════════════════════════════════════════════════
//  HELPER — bohat se branches ke tokens EK query me
//  (bidding start pe 50 suppliers ho sakte hain — 50 query nahi maarni)
//
//  Sirf woh branches jinko notification milni chahiye:
//  approved + active + banned nahi + token maujood
// ═══════════════════════════════════════════════════════
/**
 * @param {Array<ObjectId|string>} branchIds
 * @returns {Promise<Map<string, string[]>>}  branchId(string) → tokens[]
 */
async function getTokensForBranches(branchIds = []) {
  const map = new Map();
  if (!branchIds.length) return map;

  const branches = await Branch.find({
    _id:       { $in: branchIds },
    status:    "approved",
    isActive:  true,
    isBanned:  { $ne: true },
    fcmTokens: { $exists: true, $ne: [] },
  }).select("fcmTokens");

  branches.forEach(b => {
    const tokens = [...new Set((b.fcmTokens || []).filter(Boolean))];
    if (tokens.length) map.set(String(b._id), tokens);
  });

  return map;
}

// ═══════════════════════════════════════════════════════
//  1) BUYER — Bidding result (won + cancelled COMBINED)
//     biddingCron → runWinnerSelect ke end me
// ═══════════════════════════════════════════════════════
/**
 * @param {object} p
 * @param {number} p.wonCount
 * @param {number} p.cancelledCount
 * @param {number} [p.grandTotal]  - jeete hue orders ka total QAR
 */
async function notifyBiddingResult(branchId, { wonCount = 0, cancelledCount = 0, grandTotal = 0 }, tokens = null) {
  if (wonCount === 0 && cancelledCount === 0) return { skipped: true };

  const wS = wonCount > 1 ? "s" : "";
  const cS = cancelledCount > 1 ? "s" : "";

  let title, body, tab;

  if (wonCount > 0 && cancelledCount > 0) {
    // Dono — combined
    title = "Bidding Result";
    body  = `${wonCount} order${wS} confirmed${grandTotal ? ` (${grandTotal} QAR)` : ""}, `
          + `${cancelledCount} cancelled — no supplier found. Tap to view.`;
    tab   = "All";
  } else if (wonCount > 0) {
    // Sirf won
    title = "Orders Confirmed 🎉";
    body  = `Supplier found for ${wonCount} of your order${wS}`
          + `${grandTotal ? ` — ${grandTotal} QAR` : ""}. Tap to view.`;
    tab   = "Active";
  } else {
    // Sirf cancelled
    title = "Orders Cancelled";
    body  = `No supplier found for ${cancelledCount} of your order${cS}. Tap to view.`;
    tab   = "Cancelled";
  }

  return sendToBranch(branchId, {
    title,
    body,
    data: {
      type:      "bidding_result",
      screen:    SCREENS.BUYER_ORDERS,
      tab,
      wonCount,
      cancelledCount,
    },
  }, tokens);
}

// ═══════════════════════════════════════════════════════
//  2a) BUYER — Order delivered
//      riderDelivery → deliverStop (per buyer stop)
// ═══════════════════════════════════════════════════════
async function notifyOrderDelivered(branchId, { itemName, quantity, unit, buyerOrderId }, tokens = null) {
  // quantity aur unit ke beech "/" — e.g. (50 / 1kg)
  const qty = quantity ? ` (${quantity}${unit ? ` / ${unit}` : ""})` : "";

  return sendToBranch(branchId, {
    title: "Order Delivered ✅",
    body:  `Your ${itemName || "order"}${qty} has been delivered. `
         + `You have 24 hours to request a return.`,
    data: {
      type:    "order_delivered",
      screen:  SCREENS.BUYER_ORDER_DETAIL,
      orderId: buyerOrderId,
    },
  }, tokens);
}

// ═══════════════════════════════════════════════════════
//  2b) SUPPLIER — Bulk order ki saari delivery complete
//      riderDelivery → deliverStop (sirf jab allDelivered)
// ═══════════════════════════════════════════════════════
async function notifyBulkDelivered(branchId, { itemName, stopCount, bulkOrderId }, tokens = null) {
  const item = itemName || "order";
  return sendToBranch(branchId, {
    title: "Delivery Completed ✅",
    body:  stopCount > 1
      ? `All ${stopCount} deliveries for your ${item} are complete.`
      : `Your ${item} delivery is complete.`,
    data: {
      type:        "bulk_delivered",
      screen:      SCREENS.SUPPLIER_ORDERS,
      bulkOrderId,
    },
  }, tokens);
}

// ═══════════════════════════════════════════════════════
//  3) SUPPLIER — Return request aaya
//     returnOrderController → submitReturn
// ═══════════════════════════════════════════════════════
async function notifyReturnRequest(branchId, { itemName, subject, returnOrderId }, tokens = null) {
  return sendToBranch(branchId, {
    title: "Return Request",
    body:  `A buyer requested a return for ${itemName || "an order"}`
         + `${subject ? ` — "${subject}"` : ""}. Please respond.`,
    data: {
      type:          "return_request",
      screen:        SCREENS.SUPPLIER_RETURNS,
      returnOrderId,
    },
  }, tokens);
}

// ═══════════════════════════════════════════════════════
//  4) SUPPLIER — Nayi bidding khuli (jisme wo bid kar sakta hai)
//     biddingCron → runBiddingStart ke end me
// ═══════════════════════════════════════════════════════
/**
 * @param {object} p
 * @param {number} p.biddingCount - is supplier ke liye kitni biddings khuli hain
 * @param {string} [p.sampleItem] - ek item ka naam (body me dikhane ke liye)
 */
async function notifyBiddingStarted(branchId, { biddingCount = 1, sampleItem }, tokens = null) {
  const s = biddingCount > 1 ? "s" : "";
  const items = sampleItem
    ? ` — ${sampleItem}${biddingCount > 1 ? ` and ${biddingCount - 1} more` : ""}`
    : "";

  return sendToBranch(branchId, {
    title: "Bidding Open 🔔",
    body:  `${biddingCount} bidding${s} open for you${items}. Place your bid now.`,
    data: {
      type:   "bidding_started",
      screen: SCREENS.SUPPLIER_BIDDING,
      count:  biddingCount,
    },
  }, tokens);
}


// ═══════════════════════════════════════════════════════
//  5) SUPPLIER — Outbid (lead chheen li gayi)
//     biddingEngine recompute() me leaderChanged aane pe TURANT
//
//  Ye reminder se ZYADA ahem hai. Proxy bidding me supplier apni max
//  set kar ke chala jata hai; agar usay pata hi na chale ke wo peeche
//  ho gaya to poora mechanism bekaar hai.
// ═══════════════════════════════════════════════════════
/**
 * @param {object} p
 * @param {string} [p.itemName]
 * @param {number} [p.currentBid]   - nayi current bid (max bid NAHI)
 * @param {number} [p.minutesLeft]
 */
async function notifyOutbid(branchId, { itemName, currentBid, minutesLeft } = {}, tokens = null) {
  const item = itemName ? ` on ${itemName}` : "";
  const left = (minutesLeft !== null && minutesLeft !== undefined)
    ? ` ${minutesLeft} min left.`
    : "";
  const at   = (currentBid !== null && currentBid !== undefined)
    ? ` Current bid is ${currentBid}.`
    : "";

  return sendToBranch(branchId, {
    title: "You've been outbid",
    body:  `Someone has taken the lead${item}.${at}${left} Lower your max bid to get back in front.`,
    data: {
      type:       "bidding_outbid",
      screen:     SCREENS.SUPPLIER_BIDDING,
      currentBid: currentBid ?? "",
    },
  }, tokens);
}

// ═══════════════════════════════════════════════════════
//  6) SUPPLIER — Bidding closing soon (default: 10 min pehle)
//     biddingReminderCron se — har supplier ko EK push,
//     chahe uski 5 biddings chal rahi hon.
// ═══════════════════════════════════════════════════════
/**
 * @param {object} p
 * @param {string[]} p.leading    - jin items pe wo lead kar raha hai
 * @param {string[]} p.behind     - jin pe peeche hai  → action chahiye
 * @param {string[]} p.notJoined  - eligible tha, join nahi kiya → action chahiye
 * @param {number}   p.minutesLeft
 */
async function notifyBiddingClosingSoon(
  branchId,
  { leading = [], behind = [], notJoined = [], minutesLeft = 10 } = {},
  tokens = null
) {
  if (!leading.length && !behind.length && !notJoined.length) return { skipped: true };

  let title, body;

  if (behind.length > 0) {
    // Sab se urgent — join kar chuka hai lekin haar raha hai
    const s = behind.length > 1 ? "s" : "";
    title = `${minutesLeft} minutes left`;
    body  = `You're behind on ${behind.length} bidding${s}. Lower your max bid before it closes.`;
  } else if (notJoined.length > 0) {
    const s = notJoined.length > 1 ? "s" : "";
    title = `${minutesLeft} minutes left`;
    body  = `${notJoined.length} bidding${s} open for you — last chance to join.`;
  } else {
    // Sirf leading — tasalli wali khabar, koi action nahi
    const s = leading.length > 1 ? "s" : "";
    title = `${minutesLeft} minutes left`;
    body  = `You're leading on ${leading.length} bidding${s}. Nothing to do — we'll hold your position.`;
  }

  return sendToBranch(branchId, {
    title,
    body,
    data: {
      type:        "bidding_closing_soon",
      screen:      SCREENS.SUPPLIER_BIDDING,
      behind:      behind.length,
      leading:     leading.length,
      notJoined:   notJoined.length,
      minutesLeft,
    },
  }, tokens);
}

module.exports = {
  // core
  sendToBranch,
  getTokensForBranches,
  SCREENS,
  // triggers
  notifyBiddingResult,       // 1 — buyer
  notifyOrderDelivered,      // 2a — buyer
  notifyBulkDelivered,       // 2b — supplier
  notifyReturnRequest,       // 3 — supplier
  notifyBiddingStarted,      // 4 — supplier
  notifyOutbid,              // 5 — supplier (proxy bidding, real-time)
  notifyBiddingClosingSoon,  // 6 — supplier (10 min reminder)
};