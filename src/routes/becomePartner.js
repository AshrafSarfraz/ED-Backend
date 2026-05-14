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
const { adminOnly, protectAdmin } = require("../middleware/protectAdmin");


// ─── Public Routes ────────────────────────────────────────
router.post("/", createPartner); // Partner request submit karna


// ─── Admin Routes ─────────────────────────────────────────
router.get("/",              protectAdmin, adminOnly,   getAllPartners);                    // Sab partners dekho
router.get("/:id",           protectAdmin, adminOnly,   getPartner);                    // Ek partner dekho
router.put("/:id",           protectAdmin, adminOnly,   updatePartner);                 // Partner update karo
router.delete("/:id",        protectAdmin, adminOnly,   deletePartner);              // Partner delete karo
router.patch("/:id/status",  protectAdmin, adminOnly,   updateStatus);         // Approve / Reject karo

module.exports = router;