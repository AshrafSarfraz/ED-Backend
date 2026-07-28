const Invoice = require('../models/Invoice');
const MenuItem = require('../models/MenuItem');
const Counter = require('../models/Counter');
const asyncHandler = require('../utils/asyncHandler');
const { toBase, baseUnitOf, round } = require('../utils/units');
const S = require('../utils/sanitize');

const TZ_OFFSET = Number(process.env.BUSINESS_TZ_OFFSET || 3); // Qatar = UTC+3

/* GET /api/invoices?page=&limit=&month=&from=&to=&search= */
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = S.paging(req.query);
  const query = { branch: req.branch._id, ...buildDateFilter(req.query) };

  const search = S.str(req.query.search);
  if (search) {
    const rx = { $regex: S.escapeRegex(search), $options: 'i' };
    query.$or = [{ customerName: rx }, { invoiceNumber: rx }];
  }

  const [items, total] = await Promise.all([
    Invoice.find(query).select('-items.recipe').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Invoice.countDocuments(query),
  ]);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

/* GET /api/invoices/:id */
exports.getOne = asyncHandler(async (req, res) => {
  if (!S.isId(req.params.id)) throw S.bad('Invalid id');
  const invoice = await Invoice.findOne({ _id: req.params.id, branch: req.branch._id }).lean();
  if (!invoice) throw S.notFound('Invoice not found');
  res.json(invoice);
});

/* ------------------------------------------------------------------ */
/* POST /api/invoices                                                  */
/* Body: { customerName, tax, items: [{ menuItem, quantity }] }        */
/* Price/subtotal client se NAHI liye jaate - sab server calculate     */
/* ------------------------------------------------------------------ */
exports.create = asyncHandler(async (req, res) => {
  const customerName = S.str(req.body?.customerName);
  if (!customerName) throw S.bad('customerName required');

  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!rawItems.length) throw S.bad('Kam az kam 1 item chahiye');
  if (rawItems.length > 200) throw S.bad('Max 200 line items');

  const tax = req.body?.tax === undefined ? 0 : S.num(req.body.tax);
  if (Number.isNaN(tax) || tax < 0 || tax > 100) throw S.bad('tax 0-100 ke beech hona chahiye');

  /* ---- menu items load (branch-scoped) ---- */
  const ids = [];
  for (const it of rawItems) {
    const id = S.str(it?.menuItem);
    if (!S.isId(id)) throw S.bad(`Invalid menuItem id: ${it?.menuItem}`);
    ids.push(id);
  }

  const menuDocs = await MenuItem.find({ _id: { $in: ids }, branch: req.branch._id }).lean();
  const menuById = new Map(menuDocs.map((m) => [String(m._id), m]));

  /* ---- build items (same menu item repeat ho to jodh do) ---- */
  const merged = new Map();
  for (const it of rawItems) {
    const id = S.str(it.menuItem);
    const qty = S.int(it.quantity);
    if (Number.isNaN(qty) || qty <= 0) throw S.bad(`Invalid quantity for menuItem ${id}`);
    merged.set(id, (merged.get(id) || 0) + qty);
  }

  const items = [];

  for (const [id, quantity] of merged) {
    const m = menuById.get(id);
    if (!m) throw S.bad(`Menu item is branch me nahi mila: ${id}`);
    if (m.isActive === false) throw S.bad(`"${m.name}" ab available nahi hai`);

    // recipe ka snapshot - baad me recipe badle to purani usage report nahi badlegi
    const recipe = m.recipe.map((r) => ({
      ingredient: r.ingredient,
      name: r.name,
      quantity: r.quantity,
      unit: r.unit,
      baseQuantity: round(toBase(r.quantity, r.unit), 4),
      baseUnit: baseUnitOf(r.unit),
    }));

    items.push({
      menuItem: m._id,
      name: m.name,
      price: m.price,          // <-- DB se, client se nahi
      quantity,
      subtotal: round(m.price * quantity, 2),
      recipe,
    });
  }

  const subtotal = round(items.reduce((s, i) => s + i.subtotal, 0), 2);
  const taxAmount = round((subtotal * tax) / 100, 2);
  const totalAmount = round(subtotal + taxAmount, 2);

  const invoiceNumber = await nextInvoiceNumber(req.branch._id);

  const invoice = await Invoice.create({
    branch: req.branch._id,
    invoiceNumber,
    customerName,
    items,
    tax,
    taxAmount,
    subtotal,
    totalAmount,
    createdBy: req.branch._id,
  });

  res.status(201).json(invoice);
});

/* ================================================================== */

// Atomic per-branch per-day sequence. Random collision ka masla khatam.
async function nextInvoiceNumber(branchId) {
  const now = new Date();
  const local = new Date(now.getTime() + TZ_OFFSET * 3600 * 1000);
  const dateStr = local.toISOString().slice(0, 10).replace(/-/g, '');

  const c = await Counter.findByIdAndUpdate(
    `${branchId}:${dateStr}`,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `INV-${dateStr}-${String(c.seq).padStart(4, '0')}`;
}

// Business timezone ke hisaab se sahi din/mahina
function buildDateFilter(q) {
  const month = S.str(q.month);
  const from = S.str(q.from);
  const to = S.str(q.to);

  if (month) {
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    if (!m) throw S.bad('month format YYYY-MM hona chahiye');
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (mo < 1 || mo > 12) throw S.bad('Invalid month');
    return {
      createdAt: {
        $gte: new Date(Date.UTC(y, mo - 1, 1, -TZ_OFFSET)),
        $lt: new Date(Date.UTC(y, mo, 1, -TZ_OFFSET)),
      },
    };
  }

  if (from || to) {
    const range = {};
    if (from) {
      const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
      if (!d) throw S.bad('from format YYYY-MM-DD hona chahiye');
      range.$gte = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3], -TZ_OFFSET));
    }
    if (to) {
      const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to);
      if (!d) throw S.bad('to format YYYY-MM-DD hona chahiye');
      range.$lt = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3] + 1, -TZ_OFFSET));
    }
    return { createdAt: range };
  }

  return {};
}

module.exports.buildDateFilter = buildDateFilter;
