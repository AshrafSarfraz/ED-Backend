// // 📁 cron/settingService.js
// const SystemSettings = require("../models/supplier/systemSetting");

// const DEFAULTS = {
//   BIDDING_START_HOUR:  15,  // Qatar hour — bidding start cron (15 = 3 PM)
//   BIDDING_START_MIN:   45,
//   WINNER_HOUR:         15,  // Qatar hour — winner select cron
//   WINNER_MIN:          58,
//   BIDDING_CUTOFF_HOUR: 15,  // Qatar hour — placeOrder today/tomorrow cutoff
// };

// const KEY = "bidding_schedule";

// // DB se settings lao, na ho to defaults bana ke return karo
// const getBiddingSettings = async () => {
//   let doc = await SystemSettings.findOne({ key: KEY });
//   if (!doc) {
//     doc = await SystemSettings.create({
//       key:         KEY,
//       value:       DEFAULTS,
//       description: "Bidding schedule timings (Qatar time)",
//     });
//   }
//   return { ...DEFAULTS, ...doc.value };
// };

// const updateBiddingSettings = async (newValues) => {
//   const current = await getBiddingSettings();
//   const merged  = { ...current, ...newValues };

//   await SystemSettings.findOneAndUpdate(
//     { key: KEY },
//     { value: merged, description: "Bidding schedule timings (Qatar time)" },
//     { upsert: true, new: true }
//   );

//   return merged;
// };

// module.exports = { getBiddingSettings, updateBiddingSettings, DEFAULTS, KEY };



// 📁 cron/settingService.js
const SystemSettings = require("../models/supplier/systemSetting");

const DEFAULTS = {
  BIDDING_START_HOUR:  15,  // Qatar hour — bidding start cron (15 = 3 PM)
  BIDDING_START_MIN:   45,
  WINNER_HOUR:         15,  // Qatar hour — winner select cron
  WINNER_MIN:          58,
  BIDDING_CUTOFF_HOUR: 15,  // Qatar hour — placeOrder today/tomorrow cutoff
  BIDDING_CUTOFF_MIN:  45,  // Qatar minute — cutoff ka minute hissa

  // Bidding band hone se kitni der pehle reminder push jaye
  BIDDING_REMINDER_MINUTES: 10,
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

  // doc.value Mongoose document ho sakta hai — toObject() se plain object banao,
  // warna spread se fields nahi milte
  const stored =
    doc.value && typeof doc.value.toObject === "function"
      ? doc.value.toObject()
      : doc.value || {};

  return { ...DEFAULTS, ...stored };
};

const updateBiddingSettings = async (newValues) => {
  const current = await getBiddingSettings();
  const merged  = { ...current, ...newValues };

  await SystemSettings.findOneAndUpdate(
    { key: KEY },
    { value: merged, description: "Bidding schedule timings (Qatar time)" },
    { upsert: true, new: true, strict: false }
  );

  return merged;
};

// Cutoff ko minutes-since-midnight mein convert karo — comparison ke liye
const getCutoffMinutes = (settings) =>
  settings.BIDDING_CUTOFF_HOUR * 60 + settings.BIDDING_CUTOFF_MIN;

// Window ki lambai minutes me — reminder schedule karne se pehle check hota hai
const getWindowMinutes = (settings) =>
  (settings.WINNER_HOUR * 60 + settings.WINNER_MIN) -
  (settings.BIDDING_START_HOUR * 60 + settings.BIDDING_START_MIN);

module.exports = {
  getBiddingSettings,
  updateBiddingSettings,
  getCutoffMinutes,
  getWindowMinutes,
  DEFAULTS,
  KEY,
};