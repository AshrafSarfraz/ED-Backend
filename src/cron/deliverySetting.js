// 📁 cron/settingService.js me ADD karo (ya alag file)
// FIXED clock-based delivery schedule (Qatar time). Future me admin se update.
//
// Phases (Qatar time):
//   6:00 PM            → bidding end / winner select
//   6:00 PM – 10:00 AM → Supplier preparation (packing)  [SUPPLIER deadline = 10 AM next day]
//   10:00 AM – 12:00 PM → Rider pickup window
//   12:00 PM – 8:00 PM  → Rider delivery to buyer        [DELIVERY deadline = 8 PM]
//   8:00 – 9:00 PM      → grace (1 hour chhoot)
//   9:00 PM ke baad     → LATE → kis ki wajah se?

const DELIVERY_DEFAULTS = {
    // Supplier preparation deadline — agle din subah 10 baje tak ready karna hai
    SUPPLIER_READY_HOUR:  10,   // 10:00 AM (Qatar)
    SUPPLIER_READY_MIN:   0,
  
    // Rider pickup window
    PICKUP_START_HOUR:    10,   // 10:00 AM
    PICKUP_END_HOUR:      12,   // 12:00 PM
  
    // Delivery deadline — buyer ke paas 8 baje tak
    DELIVER_DEADLINE_HOUR: 20,  // 8:00 PM (20:00)
    DELIVER_DEADLINE_MIN:  0,
  
    // Grace — 9 baje tak chhoot
    GRACE_HOUR:           21,   // 9:00 PM (21:00)
    GRACE_MIN:            0,
  
    // Supplier late penalty
    LATE_PENALTY_PERCENT:  1,   // 1%
  };
  
  const DELIVERY_KEY = "delivery_schedule";
  
  const getDeliverySettings = async () => {
    // abhi fixed — future me DB se utha sakte ho
    return { ...DELIVERY_DEFAULTS };
  };
  
  // ─── Qatar time helpers (Qatar = UTC+3) ───
  const qatarNowParts = () => {
    const q = new Date(Date.now() + 3 * 60 * 60 * 1000);
    return { year: q.getUTCFullYear(), month: q.getUTCMonth(), day: q.getUTCDate(), hour: q.getUTCHours() };
  };
  
  // Qatar ke kisi din (offsetDays) ke hour:min → asli UTC Date
  const qatarTime = (hour, min, offsetDays = 0) => {
    const { year, month, day } = qatarNowParts();
    const utcMs = Date.UTC(year, month, day + offsetDays, hour, min, 0, 0) - 3 * 60 * 60 * 1000;
    return new Date(utcMs);
  };
  
  module.exports = { getDeliverySettings, DELIVERY_DEFAULTS, DELIVERY_KEY, qatarTime, qatarNowParts };