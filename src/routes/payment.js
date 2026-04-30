const express = require("express");
const router  = express.Router();
const {
  getMyInvoices,
  makePayment,
  releaseSupplierPayment,
} = require("../controllers/payment");
const { protectBranch } = require("../middleware/protectBranch");

router.get("/invoices",              protectBranch, getMyInvoices);
router.post("/pay/:invoiceId",       protectBranch, makePayment);
router.put("/release/:invoiceId",    releaseSupplierPayment); // Admin

module.exports = router;