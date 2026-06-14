// 📁 cron/settingService.js
const SystemSettings = require("../models/supplier/systemSetting");

const DEFAULTS = {
  BIDDING_START_HOUR:  15,  // Qatar hour — bidding start cron (15 = 3 PM)
  BIDDING_START_MIN:   45,
  WINNER_HOUR:         15,  // Qatar hour — winner select cron
  WINNER_MIN:          58,
  BIDDING_CUTOFF_HOUR: 15,  // Qatar hour — placeOrder today/tomorrow cutoff
};

const KEY = "bidding_schedule";

// DB se settings lao, na ho to defaults bana ke return karo
const getBiddingSettings = async () => {
  let doc = await SystemSettings.findOne({ key: KEY });
  if (!doc) {
    doc = await SystemSettings.create({
      key:         KEY,
      value:       DEFAULTS,
      description: "Bidding schedule timings (Qatar time)",
    });
  }
  return { ...DEFAULTS, ...doc.value };
};

const updateBiddingSettings = async (newValues) => {
  const current = await getBiddingSettings();
  const merged  = { ...current, ...newValues };

  await SystemSettings.findOneAndUpdate(
    { key: KEY },
    { value: merged, description: "Bidding schedule timings (Qatar time)" },
    { upsert: true, new: true }
  );

  return merged;
};

module.exports = { getBiddingSettings, updateBiddingSettings, DEFAULTS, KEY };