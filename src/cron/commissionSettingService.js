// 📁 src/cron/commissionSettingService.js
const SystemSettings = require("../models/supplier/systemSetting");

const DEFAULTS = {
  platformCommission:  2,   // % — buyer se lena (invoice pe add hota hai)
  deliveryFee:         1,   // % — buyer se lena (rider share)
  supplierPenalty:     2,   // % — return order pe supplier se kato
  buyerPaymentDays:    30,  // days — buyer invoice due date
  supplierPaymentDays: 60,  // days — supplier ko dene ki deadline
};

const KEY = "commission_settings";

const getCommissionSettings = async () => {
  let doc = await SystemSettings.findOne({ key: KEY });
  if (!doc) {
    doc = await SystemSettings.create({
      key:         KEY,
      value:       DEFAULTS,
      description: "Platform commission, fees, penalty and payment days",
    });
  }
  return { ...DEFAULTS, ...doc.value };
};

const updateCommissionSettings = async (newValues) => {
  const current = await getCommissionSettings();
  const merged  = { ...current, ...newValues };

  await SystemSettings.findOneAndUpdate(
    { key: KEY },
    { value: merged, description: "Platform commission, fees, penalty and payment days" },
    { upsert: true, new: true }
  );

  return merged;
};

module.exports = { getCommissionSettings, updateCommissionSettings, DEFAULTS, KEY };
