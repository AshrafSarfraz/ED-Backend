const express = require("express");
const router = express.Router();
const {
  createPartner,
  getAllPartners,
  getPartner,
  updateStatus,
  updatePartner,
  deletePartner,
} = require("../controllers/becomePartner");


// ─── Public Routes ────────────────────────────────────────
router.post("/", createPartner); // Partner request submit karna


// ─── Admin Routes ─────────────────────────────────────────
router.get("/", getAllPartners);                    // Sab partners dekho
router.get("/:id", getPartner);                    // Ek partner dekho
router.put("/:id", updatePartner);                 // Partner update karo
router.delete("/:id", deletePartner);              // Partner delete karo
router.patch("/:id/status", updateStatus);         // Approve / Reject karo

module.exports = router;