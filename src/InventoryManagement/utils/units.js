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

const isValidUnit = (u) => typeof u === 'string' && Object.prototype.hasOwnProperty.call(UNITS, u);

const familyOf = (u) => (isValidUnit(u) ? UNITS[u].family : null);

const sameFamily = (a, b) => isValidUnit(a) && isValidUnit(b) && UNITS[a].family === UNITS[b].family;

const baseUnitOf = (u) => (isValidUnit(u) ? UNITS[u].base : null);

// qty (in `unit`) -> qty in base unit
const toBase = (qty, unit) => Number(qty) * UNITS[unit].factor;

// cost per `unit` -> cost per base unit
const costPerBase = (cost, unit) => Number(cost) / UNITS[unit].factor;

// base qty ko readable form me: 2500 g -> { quantity: 2.5, unit: 'kg' }
const humanize = (baseQty, baseUnit) => {
  if (baseUnit === 'g' && baseQty >= 1000) return { quantity: round(baseQty / 1000, 3), unit: 'kg' };
  if (baseUnit === 'ml' && baseQty >= 1000) return { quantity: round(baseQty / 1000, 3), unit: 'litre' };
  return { quantity: round(baseQty, 3), unit: baseUnit };
};

const round = (n, d = 2) => Number(Number(n).toFixed(d));

module.exports = {
  UNITS, UNIT_LIST, isValidUnit, familyOf, sameFamily,
  baseUnitOf, toBase, costPerBase, humanize, round,
};
