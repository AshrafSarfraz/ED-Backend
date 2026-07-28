// Central unit registry. Har unit ka family + base unit + factor.
const UNITS = {
  mg:    { family: 'weight', base: 'g',   factor: 0.001 },
  g:     { family: 'weight', base: 'g',   factor: 1 },
  kg:    { family: 'weight', base: 'g',   factor: 1000 },
  ml:    { family: 'volume', base: 'ml',  factor: 1 },
  litre: { family: 'volume', base: 'ml',  factor: 1000 },
  pcs:   { family: 'count',  base: 'pcs', factor: 1 },
};

const UNIT_LIST = Object.keys(UNITS);

// Ingredient master sirf family rakhta hai (Water -> volume).
// Asli unit recipe line pe chunte hain, magar usi family ke andar se.
const FAMILIES = {
  weight: { base: 'g',   label: 'Weight' },
  volume: { base: 'ml',  label: 'Volume' },
  count:  { base: 'pcs', label: 'Count'  },
};

const FAMILY_LIST = Object.keys(FAMILIES);

const isValidUnit = (u) => typeof u === 'string' && Object.prototype.hasOwnProperty.call(UNITS, u);

const isValidFamily = (f) => typeof f === 'string' && Object.prototype.hasOwnProperty.call(FAMILIES, f);

const familyOf = (u) => (isValidUnit(u) ? UNITS[u].family : null);

const sameFamily = (a, b) => isValidUnit(a) && isValidUnit(b) && UNITS[a].family === UNITS[b].family;

// unit is family ka hai ya nahi
const unitInFamily = (u, f) => isValidUnit(u) && isValidFamily(f) && UNITS[u].family === f;

const baseUnitOf = (u) => (isValidUnit(u) ? UNITS[u].base : null);

const baseOfFamily = (f) => (isValidFamily(f) ? FAMILIES[f].base : null);

const unitsOfFamily = (f) => UNIT_LIST.filter((u) => UNITS[u].family === f);

// purane data / CSV me `unit` column ho to us se family nikal lo (kg -> weight)
const familyFromUnit = (u) => familyOf(String(u || '').toLowerCase());

// qty (in `unit`) -> qty in base unit
const toBase = (qty, unit) => Number(qty) * UNITS[unit].factor;

const round = (n, d = 2) => Number(Number(n).toFixed(d));

// base qty ko readable form me: 2500 g -> { quantity: 2.5, unit: 'kg' }
const humanize = (baseQty, baseUnit) => {
  if (baseUnit === 'g' && baseQty >= 1000) return { quantity: round(baseQty / 1000, 3), unit: 'kg' };
  if (baseUnit === 'ml' && baseQty >= 1000) return { quantity: round(baseQty / 1000, 3), unit: 'litre' };
  return { quantity: round(baseQty, 3), unit: baseUnit };
};

module.exports = {
  UNITS, UNIT_LIST, FAMILIES, FAMILY_LIST,
  isValidUnit, isValidFamily, familyOf, sameFamily, unitInFamily,
  baseUnitOf, baseOfFamily, unitsOfFamily, familyFromUnit,
  toBase, humanize, round,
};
