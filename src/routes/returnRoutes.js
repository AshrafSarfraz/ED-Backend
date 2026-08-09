// 📁 routes/returnRoutes.js
const express = require("express");
const router  = express.Router();
// Shared upload rules — return photos, max 5MB each
const upload = require("../middleware/multer");

const {
  submitReturn,
  getMyReturns,
  getSupplierReturns,
  supplierRespond,
  adminGetReturns,
  adminResolve,
  pickReturnDelivery,
  completeReturnDelivery,
  getRiderDebts,
  settleRiderDebt,
  getSupplierDebts,
} = require("../controllers/returnOrderController");

const { protectBranch }   = require("../middleware/protectBranch");
const { protectAdmin }    = require("../middleware/protectAdmin");
const { protectDelivery } = require("../middleware/protectRiderCompany");

// ─── Buyer ────────────────────────────────────────────
router.post("/buyer/submit",      protectBranch, upload.array("images", 3), submitReturn);
router.get ("/buyer/my-returns",  protectBranch, getMyReturns);

// ─── Supplier ─────────────────────────────────────────
router.get ("/supplier/requests",              protectBranch, getSupplierReturns);
router.put ("/supplier/:returnId/respond",     protectBranch, supplierRespond);

// ─── Admin ────────────────────────────────────────────
router.get ("/admin/all",                      protectAdmin,  adminGetReturns);
router.put ("/admin/:returnId/resolve",        protectAdmin,  adminResolve);
router.get ("/admin/rider-debts",              protectAdmin,  getRiderDebts);
router.put ("/admin/rider-debts/:id/settle",   protectAdmin,  settleRiderDebt);
router.get ("/admin/supplier-debts",           protectAdmin,  getSupplierDebts);

// ─── Delivery ─────────────────────────────────────────
router.put ("/delivery/:returnDeliveryId/pick",     protectDelivery, pickReturnDelivery);
router.put ("/delivery/:returnDeliveryId/complete", protectDelivery, completeReturnDelivery);

module.exports = router;

// ─── index.js mein add karo ───
// app.use("/api/returns", require("./src/routes/returnRoutes"));
