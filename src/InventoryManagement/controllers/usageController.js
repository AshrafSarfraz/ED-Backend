const Invoice = require('../models/Invoice');
const MenuItem = require('../models/MenuItem');
const Ingredient = require('../models/Ingredient');
const asyncHandler = require('../utils/asyncHandler');
const { toBase, baseUnitOf, humanize, round } = require('../utils/units');
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
    return res.json({
      ingredients: [], totalInvoices: 0, unmatchedItems: 0, filter: describe(req.query),
    });
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
  // key = ingredientId + baseUnit. Family guard ke bawajood purana data mixed ho
  // sakta hai, is liye grouping me baseUnit shamil hai - warna g aur ml jama ho jate.
  const usage = new Map();
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
        }));
      }

      for (const line of lines) {
        const id = String(line.ingredient);
        const key = `${id}|${line.baseUnit}`;
        if (!usage.has(key)) {
          usage.set(key, {
            ingredient: line.ingredient,
            id,
            name: line.name,
            baseUnit: line.baseUnit,
            baseQuantity: 0,
            items: new Map(),
          });
        }
        const b = usage.get(key);
        b.baseQuantity += line.baseQuantity * item.quantity;
        b.items.set(item.name, (b.items.get(item.name) || 0) + item.quantity);
      }
    }
  }

  /* ---- master se latest naam/category ---- */
  const ids = [...new Set([...usage.values()].map((b) => b.id))].filter(S.isId);
  const ings = await Ingredient.find({ _id: { $in: ids }, branch: req.branch._id })
    .select('name category unit').lean();
  const ingById = new Map(ings.map((i) => [String(i._id), i]));

  const ingredients = [...usage.values()]
    .map((b) => {
      const master = ingById.get(b.id);
      const h = humanize(b.baseQuantity, b.baseUnit);
      return {
        ingredient: b.ingredient,
        name: master?.name || b.name,
        category: master?.category || '',
        trackedUnit: master?.unit || null,
        quantity: h.quantity,
        unit: h.unit,
        baseQuantity: round(b.baseQuantity, 3),
        baseUnit: b.baseUnit,
        deleted: !master,
        usedInItems: [...b.items.entries()]
          .map(([menuItem, qtySold]) => ({ menuItem, qtySold }))
          .sort((a, b2) => b2.qtySold - a.qtySold),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({
    ingredients,
    totalInvoices: invoices.length,
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
