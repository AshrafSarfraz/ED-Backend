require("dotenv").config();
const express = require("express");
const cors = require("cors");
require("./src/config/db");
const { scheduleCrons } = require("./src/cron/biddingCron");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "https://admin.eldistributor.com",
    "https://company.eldistributor.com",
    "https://branch.eldistributor.com",
    "https://el-distibutor-backend.onrender.com",
    "*", // development ke liye — production me hata dena
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ─── Admin ────────────────────────────────────────────────
app.use("/api/admin/auth",      require("./src/routes/admin/auth"));
app.use("/api/admin/settings",  require("./src/routes/admin/timeSetting"));
app.use("/api/admin/dashboard", require("./src/routes/admin/dashboard"));
app.use("/api/admin",           require("./src/routes/admin/biddingSettings.route"));
app.use("/api/admin",           require("./src/routes/admin/commissionSettings.route"));
app.use("/api/admin",           require("./src/routes/admin/deliverySettings.route"));
app.use("/api/admin/bulk-orders", require("./src/routes/admin/bulkOrder"));

// ─── App routes ───────────────────────────────────────────
app.use("/api/becomePartner",   require("./src/routes/becomePartner"));
app.use("/api/company",         require("./src/routes/company"));
app.use("/api/branch",          require("./src/routes/branchRoutes"));
app.use("/api/countries",       require("./src/routes/masterData/countryRoutes"));
app.use("/api/categories",      require("./src/routes/masterData/categoryRoutes"));
app.use("/api/brands",          require("./src/routes/masterData/brandsRoutes"));
app.use("/api/items",           require("./src/routes/masterData/platformItemRoutes"));
app.use("/api/catalog",         require("./src/routes/supplier/supplierCatalogRoutes"));
app.use("/api/buyer/catalog",   require("./src/routes/buyer/catalog"));
app.use("/api/buyer/orders",    require("./src/routes/buyer/buyerOrder"));

app.use("/api/supplier/bids",   require("./src/routes/supplier/bids"));
app.use("/api/supplier/orders", require("./src/routes/supplier/supplierOrder"));
app.use("/api/supplier",        require("./src/routes/supplier/SupplierDashboard"));
app.use("/api/payments", require("./src/routes/payment"));
app.use("/api/delivery/auth",   require("./src/routes/riderCompany/RiderAuth"));
app.use("/api/delivery/orders",   require("./src/routes/riderCompany/riderDelivery"));

app.use("/api/admin/orders",             require("./src/routes/admin/orders"));
app.use("/api/admin/supplier-payments",  require("./src/routes/admin/supplierPayments"));
app.use("/api/admin/buyer-payments", require("./src/routes/admin/adminBuyerPaymentsRoute"));

app.use("/api/returns", require("./src/routes/returnRoutes"));
app.use("/api/admin/rider-earnings", require("./src/routes/admin/riderEarnings.route"));
app.use("/api/admin", require("./src/routes/admin/platformCommission.route"));
app.use("/api/admin", require("./src/routes/admin/profiles.route"));
app.use("/api/bidding-schedule", require("./src/routes/biddingSchedule.route"));

app.use("/api/app-config", require("./src/routes/AppConfig/banner"))  
app.use("/api/app-config", require("./src/routes/AppConfig/faq"))  
app.use("/api/app-config", require("./src/routes/AppConfig/terms"))  

// inventory Management 
app.use('/api/menu', require('./src/InventoryManagement/routes/menu'));
app.use('/api/billing', require('./src/InventoryManagement/routes/billing'));
const usageRoute = require('./src/InventoryManagement/routes/UsageRoutes');
app.use('/api/usage', usageRoute);





app.get("/", (req, res) => res.send("✅ El Distributor API is running!"));

// ─── 404 ──────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ success: false, message: "Route not found" })
);

// ─── Error handler ────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ success: false, message: err.message || "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  scheduleCrons(); // ← DB connect ho chuka hota hai, crons schedule karo
});