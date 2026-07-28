const MenuItem = require('../models/MenuItem');
const Ingredient = require('../models/Ingredient');
const asyncHandler = require('../utils/asyncHandler');
const { isValidUnit, unitInFamily, baseOfFamily, unitsOfFamily, round } = require('../utils/units');
const S = require('../utils/sanitize');

/* GET /api/menu-items?search=&category=&page=&limit= */
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = S.paging(req.query);
  const query = { branch: req.branch._id };

  const search = S.str(req.query.search);
  if (search) query.name = { $regex: S.escapeRegex(search), $options: 'i' };

  const category = S.str(req.query.category);
  if (category) query.category = category;

  if (S.str(req.query.active) === 'true') query.isActive = true;

  const [items, total] = await Promise.all([
    MenuItem.find(query).sort({ category: 1, name: 1 }).skip(skip).limit(limit).lean(),
    MenuItem.countDocuments(query),
  ]);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

/* GET /api/menu-items/:id  -> recipe + jo ingredients delete ho gaye unki nishandehi */
exports.getOne = asyncHandler(async (req, res) => {
  if (!S.isId(req.params.id)) throw S.bad('Invalid id');

  const item = await MenuItem.findOne({ _id: req.params.id, branch: req.branch._id }).lean();
  if (!item) throw S.notFound('Menu item not found');

  const ids = item.recipe.map((r) => r.ingredient);
  const ings = await Ingredient.find({ _id: { $in: ids }, branch: req.branch._id })
    .select('name family category').lean();
  const byId = new Map(ings.map((i) => [String(i._id), i]));

  const recipe = item.recipe.map((r) => {
    const ing = byId.get(String(r.ingredient));
    return {
      ...r,
      family: ing?.family || null,
      category: ing?.category || '',
      missing: !ing,   // ingredient master se delete ho gaya
    };
  });

  res.json({ ...item, recipe });
});

/* POST /api/menu-items */
exports.create = asyncHandler(async (req, res) => {
  const data = await readBody(req);

  const dup = await MenuItem.findOne({ branch: req.branch._id, nameKey: data.nameKey }).lean();
  if (dup) throw S.conflict(`Menu item "${dup.name}" already exists`);

  const item = await MenuItem.create({ branch: req.branch._id, ...data });
  res.status(201).json(item);
});

/* PUT /api/menu-items/:id */
exports.update = asyncHandler(async (req, res) => {
  if (!S.isId(req.params.id)) throw S.bad('Invalid id');

  const item = await MenuItem.findOne({ _id: req.params.id, branch: req.branch._id });
  if (!item) throw S.notFound('Menu item not found');

  const data = await readBody(req);

  const dup = await MenuItem.findOne({
    branch: req.branch._id,
    nameKey: data.nameKey,
    _id: { $ne: item._id },
  }).lean();
  if (dup) throw S.conflict(`Menu item "${dup.name}" already exists`);

  item.set(data);
  await item.save();
  res.json(item);
});

/* DELETE /api/menu-items/:id  -> soft delete (invoices ka history bacha rehta hai) */
exports.remove = asyncHandler(async (req, res) => {
  if (!S.isId(req.params.id)) throw S.bad('Invalid id');

  if (S.bool(req.query.hard)) {
    const gone = await MenuItem.findOneAndDelete({ _id: req.params.id, branch: req.branch._id });
    if (!gone) throw S.notFound('Menu item not found');
    return res.json({ message: 'Menu item permanently deleted' });
  }

  const item = await MenuItem.findOneAndUpdate(
    { _id: req.params.id, branch: req.branch._id },
    { $set: { isActive: false } },
    { new: true }
  );
  if (!item) throw S.notFound('Menu item not found');
  res.json({ message: 'Menu item deactivated', item });
});

/* ================================================================== */

async function readBody(req) {
  const src = req.body || {};

  const name = S.str(src.name);
  if (!name) throw S.bad('name required');

  const price = S.num(src.price);
  if (Number.isNaN(price) || price < 0) throw S.bad('price valid number hona chahiye');

  const category = S.str(src.category);
  if (!category) throw S.bad('category required');

  const rawRecipe = Array.isArray(src.recipe) ? src.recipe : [];
  if (rawRecipe.length > 100) throw S.bad('Recipe me max 100 lines');

  const recipe = [];
  if (rawRecipe.length) {
    const ids = [];
    for (const line of rawRecipe) {
      const id = S.str(line?.ingredient);
      if (!S.isId(id)) throw S.bad(`Invalid ingredient id: ${line?.ingredient}`);
      ids.push(id);
    }

    // sirf ISI branch ke ingredients - cross-branch leak band
    const found = await Ingredient.find({ _id: { $in: ids }, branch: req.branch._id }).lean();
    const byId = new Map(found.map((i) => [String(i._id), i]));

    const seen = new Set();
    for (const line of rawRecipe) {
      const id = S.str(line.ingredient);
      const ing = byId.get(id);
      if (!ing) throw S.bad(`Ingredient not found in this branch: ${id}`);
      if (seen.has(id)) throw S.bad(`"${ing.name}" recipe me do baar hai`);
      seen.add(id);

      const qty = S.num(line.quantity);
      if (Number.isNaN(qty) || qty <= 0) throw S.bad(`"${ing.name}" ki quantity valid honi chahiye`);

      // unit optional - na do to family ka base unit (volume -> ml)
      const unit = S.str(line.unit).toLowerCase() || baseOfFamily(ing.family);
      if (!isValidUnit(unit)) throw S.bad(`Invalid unit "${line.unit}" for "${ing.name}"`);

      // yahi wo guard hai jo `water 200 g` rokta hai
      if (!unitInFamily(unit, ing.family)) {
        throw S.bad(
          `"${ing.name}" ${ing.family} hai - "${unit}" use nahi kar sakte. Allowed: ${unitsOfFamily(ing.family).join(', ')}`
        );
      }

      recipe.push({ ingredient: ing._id, name: ing.name, quantity: qty, unit });
    }
  }

  return {
    name,
    nameKey: S.nameKey(name),
    price: round(price, 2),
    category,
    recipe,
    isActive: src.isActive === undefined ? true : S.bool(src.isActive),
  };
}
