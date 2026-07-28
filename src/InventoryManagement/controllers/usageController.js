const Invoice = require('../models/Invoice');
const MenuItem = require('../models/MenuItem');
const Ingredient = require('../models/Ingredient');
const asyncHandler = require('../utils/asyncHandler');
const { toBase, costPerBase, baseUnitOf, humanize, round } = require('../utils/units');
const { buildDateFilter } = require('./invoiceController');
const S = require('../utils/sanitize');

/* ------------------------------------------------------------------ */
/* GET /api/usage?month=2026-03                                        */
/* GET /api/usage?from=2026-03-01&to=2026-03-31                        */
/* ------------------------------------------------------------------ */
exports.report = asyncHandler(async (req, res) => {
  const dateFilter = buildDateFilter(req.query);

  const invoices = await Invoice.find({ branch: req.branch._id, ...dateFilter })
    .select('items createdAt')
    .lean();

  if (!invoices.length) {
    return res.json({ ingredients: [], totalInvoices: 0, totalIngredientCost: 0, filter: describe(req.query) });
  }

  // purani invoices (bina snapshot) ke liye fallback recipe
  const legacyIds = [];
  for (const inv of invoices) {
    for (const it of inv.items) {
      if (!it.recipe?.length && it.menuItem) legacyIds.push(it.menuItem);
    }
  }
  const legacyRecipe = new Map();
  if (legacyIds.length) {
    const docs = await MenuItem.find({ _id: { $in: legacyIds }, branch: req.branch._id })
      .select('recipe').lean();
    docs.forEach((d) => legacyRecipe.set(String(d._id), d.recipe || []));
  }

  /* ---- aggregate ---- */
  const usage = new Map();   // ingredientId -> bucket
  let unmatchedItems = 0;

  for (const inv of invoices) {
    for (const item of inv.items) {
      let lines = item.recipe;

      if (!lines?.length) {
        const fallback = legacyRecipe.get(String(item.menuItem));
        if (!fallback?.length) { unmatchedItems += item.quantity; continue; }
        lines = fallback.map((r) => ({
          ingredient: r.ingredient,
          name: r.name,
          quantity: r.quantity,
          unit: r.unit,
          baseQuantity: toBase(r.quantity, r.unit),
          baseUnit: baseUnitOf(r.unit),
          costPerBaseUnit: 0,
        }));
      }

      for (const line of lines) {
        const key = String(line.ingredient);
        if (!usage.has(key)) {
          usage.set(key, {
            ingredient: line.ingredient,
            name: line.name,
            baseUnit: line.baseUnit,
            baseQuantity: 0,
            cost: 0,
            items: new Map(),
          });
        }
        const b = usage.get(key);
        const qty = line.baseQuantity * item.quantity;
        b.baseQuantity += qty;
        b.cost += qty * (line.costPerBaseUnit || 0);
        b.items.set(item.name, (b.items.get(item.name) || 0) + item.quantity);
      }
    }
  }

  /* ---- live cost fill (agar snapshot me cost 0 tha) ---- */
  const ings = await Ingredient.find({
    _id: { $in: [...usage.keys()].filter(S.isId) },
    branch: req.branch._id,
  }).lean();
  const ingById = new Map(ings.map((i) => [String(i._id), i]));

  const ingredients = [...usage.entries()]
    .map(([id, b]) => {
      const master = ingById.get(id);
      let cost = b.cost;
      if (!cost && master) cost = b.baseQuantity * costPerBase(master.costPerUnit, master.unit);
      const h = humanize(b.baseQuantity, b.baseUnit);
      return {
        ingredient: b.ingredient,
        name: master?.name || b.name,
        category: master?.category || '',
        quantity: h.quantity,
        unit: h.unit,
        baseQuantity: round(b.baseQuantity, 3),
        baseUnit: b.baseUnit,
        estimatedCost: round(cost, 2),
        deleted: !master,
        usedInItems: [...b.items.entries()]
          .map(([menuItem, qtySold]) => ({ menuItem, qtySold }))
          .sort((a, b2) => b2.qtySold - a.qtySold),
      };
    })
    .sort((a, b) => b.estimatedCost - a.estimatedCost || b.baseQuantity - a.baseQuantity);

  res.json({
    ingredients,
    totalInvoices: invoices.length,
    totalIngredientCost: round(ingredients.reduce((s, i) => s + i.estimatedCost, 0), 2),
    unmatchedItems,
    filter: describe(req.query),
  });
});

function describe(q) {
  const month = S.str(q.month);
  const from = S.str(q.from);
  const to = S.str(q.to);
  if (month) return { type: 'month', value: month };
  if (from || to) return { type: 'range', from, to };
  return { type: 'all' };
}
