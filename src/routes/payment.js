// 📁 routes/payment.js
const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const upload  = multer({ storage: multer.memoryStorage() });

const {
  getPaymentDashboard,
  submitReceipt,
  getMyReceipts,
  adminGetReceipts,
  approveReceipt,
  rejectReceipt,
  adminBuyerSummary,
  supplierPaymentSummary,
} = require("../controllers/PaymentControllers");

const { protectBranch }  = require("../middleware/protectBranch");
const { protectAdmin }   = require("../middleware/protectAdmin");

// ─── Buyer ────────────────────────────────────────────
router.get ("/buyer/dashboard",          protectBranch, getPaymentDashboard);
router.post("/buyer/submit",             protectBranch, upload.single("receiptImage"), submitReceipt);
router.get ("/buyer/receipts",           protectBranch, getMyReceipts);

// ─── Supplier ─────────────────────────────────────────
router.get ("/supplier/summary",         protectBranch, supplierPaymentSummary);

// ─── Admin ────────────────────────────────────────────
router.get ("/admin/receipts",           protectAdmin,  adminGetReceipts);
router.get ("/admin/buyers",             protectAdmin,  adminBuyerSummary);
router.put ("/admin/receipts/:receiptId/approve", protectAdmin, approveReceipt);
router.put ("/admin/receipts/:receiptId/reject",  protectAdmin, rejectReceipt);

module.exports = router;

// ─── server.js mein add karo ───
// app.use("/api/payments", require("./src/routes/payment"));