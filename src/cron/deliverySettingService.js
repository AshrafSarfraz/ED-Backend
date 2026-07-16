// 📁 src/cron/deliverySettingService.js
const SystemSettings = require("../models/supplier/systemSetting");

const DEFAULTS = {
  pickupStartHour:     10,  // 10 AM Qatar — rider pickup window start
  pickupEndHour:       12,  // 12 PM Qatar — supplier ready deadline (baad mein = late)
  deliverDeadlineHour: 20,  // 8 PM Qatar — rider must deliver by
  graceHour:           21,  // 9 PM Qatar — grace period end
};

const KEY = "delivery_settings";

const getDeliverySettings = async () => {
  let doc = await SystemSettings.findOne({ key: KEY });
  if (!doc) {
    doc = await SystemSettings.create({
      key:         KEY,
      value:       DEFAULTS,
      description: "Delivery window timings (Qatar time)",
    });
  }
  return { ...DEFAULTS, ...doc.value };
};

const updateDeliverySettings = async (newValues) => {
  const current = await getDeliverySettings();
  const merged  = { ...current, ...newValues };
  await SystemSettings.findOneAndUpdate(
    { key: KEY },
    { value: merged, description: "Delivery window timings (Qatar time)" },
    { upsert: true, new: true }
  );
  return merged;
};

module.exports = { getDeliverySettings, updateDeliverySettings, DEFAULTS, KEY };
