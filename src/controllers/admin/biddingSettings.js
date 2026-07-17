// 📁 controllers/admin/biddingSettings.js
const { getBiddingSettings, updateBiddingSettings } = require("../../cron/settingService");
const { scheduleCrons } = require("../../cron/biddingCron");   // ← FIX: pehle "../../" toota tha

// ═══════════════════════════════════════════════════════
//  PUBLIC (branch apps) — order deadline + bidding end time
//  GET /api/bidding-schedule
//  Buyer/Supplier apps ke liye — sirf start/end time, koi sensitive data nahi
// ═══════════════════════════════════════════════════════
const pad = (n) => String(n).padStart(2, "0");

exports.getPublicSchedule = async (req, res) => {
  try {
    const s = await getBiddingSettings();
    res.json({
      success: true,
      data: {
        // "Order Deadline" — orders is waqt tak place ho sakte hain, uske baad kal ki bidding mein jaate hain
        startTime: `${pad(s.BIDDING_START_HOUR)}:${pad(s.BIDDING_START_MIN)}`,
        // Bidding khatam / winner select hone ka waqt
        endTime:   `${pad(s.WINNER_HOUR)}:${pad(s.WINNER_MIN)}`,
      },
    });
  } catch (err) {
    console.error("getPublicSchedule error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Get current bidding schedule
//  GET /api/admin/bidding-settings
// ═══════════════════════════════════════════════════════
exports.getSettings = async (req, res) => {
  try {
    const settings = await getBiddingSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error("getSettings error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ═══════════════════════════════════════════════════════
//  ADMIN — Update + reschedule crons
//  PUT /api/admin/bidding-settings
// ═══════════════════════════════════════════════════════
exports.updateSettings = async (req, res) => {
  try {
    const {
      BIDDING_START_HOUR,
      BIDDING_START_MIN,
      WINNER_HOUR,
      WINNER_MIN,
      BIDDING_CUTOFF_HOUR,
    } = req.body;

    // basic validation
    const inRange = (v, max) =>
      v === undefined || (Number.isInteger(v) && v >= 0 && v <= max);

    if (
      ![BIDDING_START_HOUR, WINNER_HOUR, BIDDING_CUTOFF_HOUR].every((v) => inRange(v, 23)) ||
      ![BIDDING_START_MIN, WINNER_MIN].every((v) => inRange(v, 59))
    ) {
      return res.status(400).json({ success: false, message: "Invalid hour/minute values" });
    }

    // merged values nikal lo (taake cross-field validation kar sakein)
    const current = await getBiddingSettings();
    const next = {
      ...current,
      ...(BIDDING_START_HOUR  !== undefined && { BIDDING_START_HOUR }),
      ...(BIDDING_START_MIN   !== undefined && { BIDDING_START_MIN }),
      ...(WINNER_HOUR         !== undefined && { WINNER_HOUR }),
      ...(WINNER_MIN          !== undefined && { WINNER_MIN }),
      ...(BIDDING_CUTOFF_HOUR !== undefined && { BIDDING_CUTOFF_HOUR }),
    };

    // ─── Cross-field guards (dead-zone se bachne ke liye) ───
    const startMins  = next.BIDDING_START_HOUR * 60 + next.BIDDING_START_MIN;
    const winnerMins = next.WINNER_HOUR * 60 + next.WINNER_MIN;

    if (winnerMins <= startMins) {
      return res.status(400).json({
        success: false,
        message: "Winner time must be after bidding start time",
      });
    }
    if (next.BIDDING_CUTOFF_HOUR > next.BIDDING_START_HOUR) {
      return res.status(400).json({
        success: false,
        message: "Cutoff hour cannot be after bidding start hour (orders would get stuck)",
      });
    }

    const updated = await updateBiddingSettings(next);

    // crons turant reschedule
    await scheduleCrons();

    res.json({ success: true, message: "Bidding schedule updated", data: updated });
  } catch (err) {
    console.error("updateSettings error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};