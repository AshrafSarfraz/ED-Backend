const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const MenuItem = require('../models/MenuItem');
const { protectBranch } = require('../../middleware/protectBranch');

// GET /api/usage
// Query params:
//   ?month=2026-03                   → filter by month (YYYY-MM)
//   ?from=2026-03-01&to=2026-03-31   → filter by date range
router.get('/', protectBranch, async (req, res) => {
  try {
    const { month, from, to } = req.query;

    // --- Build date filter ---
    let dateFilter = {};

    if (month) {
      const [year, mon] = month.split('-').map(Number);
      const start = new Date(year, mon - 1, 1);
      const end   = new Date(year, mon, 1);
      dateFilter = { createdAt: { $gte: start, $lt: end } };
    } else if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = toDate;
      }
    }

    // --- Fetch invoices for this branch ---
    const invoices = await Invoice.find({ branch: req.branch._id, ...dateFilter });

    if (invoices.length === 0) {
      return res.json({ ingredients: [], totalInvoices: 0 });
    }

    // --- Aggregate: { itemName -> totalQtySold } ---
    const soldMap = {};
    for (const invoice of invoices) {
      for (const item of invoice.items) {
        const key = item.name.toLowerCase().trim();
        soldMap[key] = (soldMap[key] || 0) + item.quantity;
      }
    }

    // --- Fetch all MenuItems for this branch ---
    const menuItems = await MenuItem.find({ branch: req.branch._id });

    // --- Calculate ingredient usage ---
    const ingredientUsage = {};

    for (const menuItem of menuItems) {
      const key = menuItem.name.toLowerCase().trim();
      const qtySold = soldMap[key] || 0;
      if (qtySold === 0) continue;

      for (const ing of menuItem.ingredients) {
        const ingKey = `${ing.name.toLowerCase().trim()}|${ing.unit}`;
        if (!ingredientUsage[ingKey]) {
          ingredientUsage[ingKey] = {
            name: ing.name,
            unit: ing.unit,
            totalQuantity: 0,
            usedInItems: [],
          };
        }
        ingredientUsage[ingKey].totalQuantity += ing.quantity * qtySold;
        ingredientUsage[ingKey].usedInItems.push({
          menuItem: menuItem.name,
          qtySold,
          quantityPerItem: ing.quantity,
        });
      }
    }

    const ingredients = Object.values(ingredientUsage).sort(
      (a, b) => b.totalQuantity - a.totalQuantity
    );

    res.json({
      ingredients,
      totalInvoices: invoices.length,
      filter: month
        ? { type: 'month', value: month }
        : from || to
        ? { type: 'range', from, to }
        : { type: 'all' },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;