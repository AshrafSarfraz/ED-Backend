require("dotenv").config();
require("./src/cron/biddingCron");
const express = require("express");
const cors = require("cors");
require("./src/config/db");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "https://el-distibutor-backend.onrender.com",
    "*" // development ke liye
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));


app.use("/api/admin/settings", require("./src/routes/admin/timeSetting"));



app.use("/api/becomePartner",   require("./src/routes/becomePartner") );
app.use("/api/company",         require("./src/routes/company"));
app.use("/api/branch",          require("./src/routes/branchRoutes"));
app.use("/api/countries",       require("./src/routes/countryRoutes"));
app.use("/api/categories",      require("./src/routes/categoryRoutes"));
app.use("/api/items",           require("./src/routes/platformItemRoutes"));
app.use("/api/catalog",         require("./src/routes/supplier/supplierCatalogRoutes"));
app.use("/api/buyer/catalog",   require("./src/routes/buyer/catalog"));
app.use("/api/buyer/orders",    require("./src/routes/buyer/buyerOrder"));
app.use("/api/supplier/bids",   require("./src/routes/supplier/bids"));
app.use("/api/supplier/orders", require("./src/routes/supplier/supplierOrder"));
app.use("/api/buyer/payments", require("./src/routes/payment"));

app.use("/api/rider-company",   require("./src/routes/rider/riderCompany"));



app.get("/", (req, res) => res.send("✅ El Distributor API is running!"));






app.use((req, res) =>
  res.status(404).json({ success: false, message: "Route not found" })
);

app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ success: false, message: err.message || "Internal server error" });
});

app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
