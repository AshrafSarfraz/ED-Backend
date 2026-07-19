const Company     = require("../../models/createCompany");
const Branch      = require("../../models/Branch");
const BuyerOrder  = require("../../models/buyer/buyerOrder");
const BulkOrder   = require("../../models/BulkOrder");
const Invoice     = require("../../models/invoice");
const Partner     = require("../../models/becomePartner");
const ReturnOrder = require("../../models/returnOrder/ReturnOrder");
const RiderDebt   = require("../../models/returnOrder/RiderDebt");

// ═══════════════════════════════════════════════════════
//  ADMIN — Dashboard Stats
//  GET /api/admin/dashboard
// ═══════════════════════════════════════════════════════
exports.getDashboard = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalCompanies,
      totalBranches,
      pendingBranches,
      totalOrders,
      todayOrders,
      totalInvoices,
      unpaidInvoices,
      pendingPartners,
      totalPartners,
      supplierBranches,
      buyerBranches,
      pendingDocuments,
      totalReturns,
      pendingReturns,
      unsettledRiderDebts,
    ] = await Promise.all([
      Company.countDocuments(),
      Branch.countDocuments(),
      Branch.countDocuments({ status: "pending" }),
      BuyerOrder.countDocuments(),
      BuyerOrder.countDocuments({ createdAt: { $gte: today } }),
      Invoice.countDocuments({ invoiceType: "buyer" }),
      Invoice.countDocuments({ invoiceType: "buyer", paymentStatus: { $in: ["unpaid", "overdue"] } }),
      Partner.countDocuments({ status: "New Request" }),
      Partner.countDocuments(),
      Branch.countDocuments({ accountType: "Supplier" }),
      Branch.countDocuments({ accountType: "Buyer" }),
      Company.countDocuments({ documentsStatus: "submitted" }),
      ReturnOrder.countDocuments(),
      ReturnOrder.countDocuments({ status: { $in: ["pending", "supplier_accepted", "supplier_rejected"] } }),
      RiderDebt.countDocuments({ settled: false }),
    ]);

    // Revenue
    const revenueResult = await Invoice.aggregate([
      { $match: { invoiceType: "buyer", paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$grandTotal" }, commission: { $sum: "$totalFeeAmount" } } },
    ]);

    const totalRevenue    = revenueResult[0]?.total      || 0;
    const totalCommission = revenueResult[0]?.commission || 0;

    // Last 7 days orders
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date  = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const next  = new Date(date);
      next.setDate(next.getDate() + 1);
      const count = await BuyerOrder.countDocuments({
        createdAt: { $gte: date, $lt: next },
      });
      last7Days.push({
        date:  date.toLocaleDateString("en-US", { weekday: "short" }),
        orders: count,
      });
    }

    res.json({
      success: true,
      data: {
        companies: {
          total:           totalCompanies,
          pendingDocuments,
        },
        branches: {
          total:    totalBranches,
          pending:  pendingBranches,
          supplier: supplierBranches,
          buyer:    buyerBranches,
        },
        orders: {
          total: totalOrders,
          today: todayOrders,
        },
        invoices: {
          total:   totalInvoices,
          unpaid:  unpaidInvoices,
        },
        revenue: {
          total:      totalRevenue,
          commission: totalCommission,
        },
        partners: {
          total:   totalPartners,
          pending: pendingPartners,
        },
        returns: {
          total:   totalReturns,
          pending: pendingReturns,
        },
        riderDebts: {
          unsettled: unsettledRiderDebts,
        },
        chart: last7Days,
      },
    });
  } catch (err) {
    console.error("getDashboard error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};