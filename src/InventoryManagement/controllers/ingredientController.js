const Ingredient = require('../models/Ingredient');
const MenuItem = require('../models/MenuItem');
const asyncHandler = require('../utils/asyncHandler');
const { parseCsv, headerMap, pick } = require('../utils/csv');
const { UNIT_LIST, isValidUnit, familyOf, unitsOfFamily } = require('../utils/units');
const S = require('../utils/sanitize');

const MAX_ROWS = 5000;

/* ------------------------------------------------------------------ */
/* GET /api/ingredients?search=&category=&page=&limit=                 */
/* ------------------------------------------------------------------ */
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = S.paging(req.query);
  const query = { branch: req.branch._id };

  const search = S.str(req.query.search);
  if (search) query.name = { $regex: S.escapeRegex(search), $options: 'i' };

  const category = S.str(req.query.category);
  if (category) query.category = category;

  const unit = S.str(req.query.unit).toLowerCase();
  if (unit) {
    if (!isValidUnit(unit)) throw S.bad(`Invalid unit "${unit}". Allowed: ${UNIT_LIST.join(', ')}`);
    query.unit = unit;
  }

  if (S.str(req.query.active) === 'true') query.isActive = true;

  const [items, total] = await Promise.all([
    Ingredient.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Ingredient.countDocuments(query),
  ]);

  // frontend ko batado recipe me is ingredient ke liye kaunse units chalenge
  res.json({
    items: items.map((i) => ({ ...i, units: unitsOfFamily(familyOf(i.unit)) })),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});

/* ------------------------------------------------------------------ */
/* POST /api/ingredients   (single add)                                */
/* ------------------------------------------------------------------ */
exports.create = asyncHandler(async (req, res) => {
  const data = readBody(req.body);

  const dup = await Ingredient.findOne({ branch: req.branch._id, nameKey: data.nameKey }).lean();
  if (dup) throw S.conflict(`Ingredient "${dup.name}" already exists`);

  const doc = await Ingredient.create({ branch: req.branch._id, ...data });
  res.status(201).json({ ...doc.toObject(), units: unitsOfFamily(familyOf(doc.unit)) });
});

/* ------------------------------------------------------------------ */
/* PUT /api/ingredients/:id   (single edit)                            */
/* ------------------------------------------------------------------ */
exports.update = asyncHandler(async (req, res) => {
  if (!S.isId(req.params.id)) throw S.bad('Invalid ingredient id');

  const existing = await Ingredient.findOne({ _id: req.params.id, branch: req.branch._id });
  if (!existing) throw S.notFound('Ingredient not found');

  const data = readBody(req.body);

  // unit family badal rahi hai aur ingredient recipes me use ho raha hai -> block.
  // warna `water 200 ml` aur `water 200 g` mil kar ghalat total banate hain.
  // (ml -> litre chalega, ml -> g nahi)
  if (familyOf(data.unit) !== familyOf(existing.unit)) {
    const used = await MenuItem.countDocuments({
      branch: req.branch._id,
      'recipe.ingredient': existing._id,
    });
    if (used > 0) {
      throw S.conflict(
        `"${existing.name}" ${used} menu item(s) me use ho raha hai - "${existing.unit}" se "${data.unit}" nahi ho sakta. Pehle un recipes se hatao.`,
        { menuItemsAffected: used }
      );
    }
  }

  const dup = await Ingredient.findOne({
    branch: req.branch._id,
    nameKey: data.nameKey,
    _id: { $ne: existing._id },
  }).lean();
  if (dup) throw S.conflict(`Ingredient "${dup.name}" already exists`);

  existing.set(data);
  await existing.save();

  // naam badla -> menu recipes ka denormalized naam sync kar do
  await MenuItem.updateMany(
    { branch: req.branch._id, 'recipe.ingredient': existing._id },
    { $set: { 'recipe.$[el].name': existing.name } },
    { arrayFilters: [{ 'el.ingredient': existing._id }] }
  );

  res.json({ ...existing.toObject(), units: unitsOfFamily(familyOf(existing.unit)) });
});

/* ------------------------------------------------------------------ */
/* DELETE /api/ingredients/:id?force=true                              */
/* ------------------------------------------------------------------ */
exports.remove = asyncHandler(async (req, res) => {
  if (!S.isId(req.params.id)) throw S.bad('Invalid ingredient id');

  const doc = await Ingredient.findOne({ _id: req.params.id, branch: req.branch._id });
  if (!doc) throw S.notFound('Ingredient not found');

  const usedIn = await MenuItem.find({
    branch: req.branch._id,
    'recipe.ingredient': doc._id,
  }).select('name').lean();

  if (usedIn.length && !S.bool(req.query.force)) {
    throw S.conflict(
      `"${doc.name}" ${usedIn.length} menu item(s) me use ho raha hai. Delete karne ke liye ?force=true bhejo`,
      { usedIn: usedIn.map((m) => m.name) }
    );
  }

  if (usedIn.length) {
    await MenuItem.updateMany(
      { branch: req.branch._id, 'recipe.ingredient': doc._id },
      { $pull: { recipe: { ingredient: doc._id } } }
    );
  }

  await doc.deleteOne();
  res.json({ message: 'Ingredient deleted', removedFromMenuItems: usedIn.length });
});

/* ------------------------------------------------------------------ */
/* POST /api/ingredients/bulk?force=true                               */
/*   Body: multipart file `file` | { csv: "..." } | { rows: [...] }    */
/*   REPLACE mode: CSV me jo nahi hai wo DB se hat jayega              */
/* ------------------------------------------------------------------ */
exports.bulkUpload = asyncHandler(async (req, res) => {
  const rows = extractRows(req);
  if (!rows.length) throw S.bad('CSV khali hai ya koi valid row nahi mili');
  if (rows.length > MAX_ROWS) throw S.bad(`Max ${MAX_ROWS} rows allowed, mile ${rows.length}`);

  /* ---- 1. validate + dedupe ---- */
  const parsed = new Map();   // nameKey -> data
  const errors = [];

  rows.forEach((raw, i) => {
    const line = i + 2; // header ke baad
    try {
      const data = readBody(raw);
      if (parsed.has(data.nameKey)) {
        errors.push({ line, message: `Duplicate name "${data.name}" file me` });
        return;
      }
      parsed.set(data.nameKey, data);
    } catch (e) {
      errors.push({ line, message: e.message });
    }
  });

  if (errors.length) throw S.bad('CSV me errors hain, kuch bhi save nahi hua', { errors });

  /* ---- 2. existing nikaalo ---- */
  const existing = await Ingredient.find({ branch: req.branch._id }).lean();
  const existingByKey = new Map(existing.map((d) => [d.nameKey, d]));

  const toDelete = existing.filter((d) => !parsed.has(d.nameKey));
  const familyChanged = [];
  for (const [key, data] of parsed) {
    const prev = existingByKey.get(key);
    if (prev && familyOf(prev.unit) !== familyOf(data.unit)) familyChanged.push({ prev, data });
  }

  /* ---- 3. safety check: recipes toot to nahi rahi ---- */
  const force = S.bool(req.query.force);
  const riskyIds = [...toDelete.map((d) => d._id), ...familyChanged.map((f) => f.prev._id)];

  if (riskyIds.length) {
    const affected = await MenuItem.find({
      branch: req.branch._id,
      'recipe.ingredient': { $in: riskyIds },
    }).select('name recipe').lean();

    if (affected.length && !force) {
      const idSet = new Set(riskyIds.map(String));
      throw S.conflict(
        'Ye upload kuch menu recipes tod dega. Confirm karne ke liye ?force=true bhejo',
        {
          menuItemsAffected: affected.map((m) => ({
            name: m.name,
            ingredients: m.recipe.filter((r) => idSet.has(String(r.ingredient))).map((r) => r.name),
          })),
          willDelete: toDelete.map((d) => d.name),
          unitFamilyChanged: familyChanged.map((f) => `${f.prev.name}: ${f.prev.unit} -> ${f.data.unit}`),
        }
      );
    }
  }

  /* ---- 4. apply. Upsert by name -> _id preserve, links salaamat ---- */
  const ops = [...parsed.values()].map((data) => ({
    updateOne: {
      filter: { branch: req.branch._id, nameKey: data.nameKey },
      // isActive ko chhora nahi ja raha - CSV me wo column nahi hota, is liye
      // upload deactivated ingredient ko chupke se active na kare
      update: {
        $set: { name: data.name, unit: data.unit, category: data.category, branch: req.branch._id },
        $setOnInsert: { isActive: true },
      },
      upsert: true,
    },
  }));

  const result = await Ingredient.bulkWrite(ops, { ordered: false });

  let cleanedMenuItems = 0;
  if (toDelete.length) {
    const delIds = toDelete.map((d) => d._id);
    const pull = await MenuItem.updateMany(
      { branch: req.branch._id, 'recipe.ingredient': { $in: delIds } },
      { $pull: { recipe: { ingredient: { $in: delIds } } } }
    );
    cleanedMenuItems = pull.modifiedCount || 0;
    await Ingredient.deleteMany({ branch: req.branch._id, _id: { $in: delIds } });
  }

  res.json({
    message: 'Bulk upload complete',
    inserted: result.upsertedCount || 0,
    updated: result.modifiedCount || 0,
    deleted: toDelete.length,
    totalNow: parsed.size,
    cleanedMenuItems,
  });
});

/* ------------------------------------------------------------------ */
/* GET /api/ingredients/template  -> sample CSV download               */
/* ------------------------------------------------------------------ */
exports.template = (req, res) => {
  const csv =
    'name,unit,category\n' +
    'Water,ml,Liquids\n' +
    'Chicken,g,Meat\n' +
    'Chilli,g,Spices\n' +
    'Oil,ml,Liquids\n' +
    'Burger Bun,pcs,Bakery\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ingredients-template.csv"');
  res.send(csv);
};

/* ================================================================== */
/* helpers                                                             */
/* ================================================================== */

// Ek row/body -> clean ingredient object. Whitelist only (mass-assignment band).
function readBody(src = {}) {
  const name = S.str(src.name);
  if (!name) throw S.bad('name required');
  if (name.length > 120) throw S.bad(`name bohat lamba: "${name.slice(0, 30)}..."`);

  const unit = S.str(src.unit).toLowerCase();
  if (!isValidUnit(unit)) {
    throw S.bad(`"${name}" ki unit invalid hai${src.unit ? ` ("${src.unit}")` : ''}. Allowed: ${UNIT_LIST.join(', ')}`);
  }

  return {
    name,
    nameKey: S.nameKey(name),
    unit,
    category: S.str(src.category).slice(0, 60),
    isActive: src.isActive === undefined ? true : S.bool(src.isActive),
  };
}

// multipart file | { csv } | { rows: [] } -> array of plain objects
function extractRows(req) {
  if (Array.isArray(req.body?.rows)) return req.body.rows.slice(0, MAX_ROWS + 1);

  let text = '';
  if (req.file?.buffer) text = req.file.buffer.toString('utf8');
  else if (typeof req.body?.csv === 'string') text = req.body.csv;
  else if (typeof req.body === 'string') text = req.body;

  if (!text.trim()) throw S.bad('CSV file ya `csv` text ya `rows` array bhejo');

  const grid = parseCsv(text);
  if (grid.length < 2) throw S.bad('CSV me header + kam az kam 1 data row honi chahiye');

  const map = headerMap(grid[0]);
  if (!('name' in map)) throw S.bad('CSV me `name` column zaroori hai');
  if (!('unit' in map)) throw S.bad(`CSV me \`unit\` column zaroori hai (${UNIT_LIST.join(' / ')})`);

  return grid.slice(1).map((row) => ({
    name: pick(map, row, 'name', 'ingredient', 'ingredientname'),
    unit: pick(map, row, 'unit', 'uom', 'measure'),
    category: pick(map, row, 'category', 'group', 'type'),
  }));
}
