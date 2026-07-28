// Sab input yahan se guzarta hai. Object/array aa jaye to reject -> NoSQL injection band.

const OID_RE = /^[a-fA-F0-9]{24}$/;

const str = (v, fallback = '') => (typeof v === 'string' ? v.trim() : fallback);

const num = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
};

const int = (v) => {
  const n = num(v);
  return Number.isInteger(n) ? n : NaN;
};

const bool = (v) => v === true || v === 'true' || v === '1';

const isId = (v) => typeof v === 'string' && OID_RE.test(v);

// name -> lookup key ("  Chicken   Breast " -> "chicken breast")
const nameKey = (v) => str(v).toLowerCase().replace(/\s+/g, ' ').trim();

// pagination clamp
const paging = (q) => {
  const page = Math.max(1, int(q.page) || 1);
  const limit = Math.min(200, Math.max(1, int(q.limit) || 50));
  return { page, limit, skip: (page - 1) * limit };
};

// regex escape (search me user input safe rakhne ke liye)
const escapeRegex = (v) => str(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    if (details) this.details = details;
  }
}

const bad = (msg, details) => new ApiError(400, msg, details);
const notFound = (msg = 'Not found') => new ApiError(404, msg);
const conflict = (msg, details) => new ApiError(409, msg, details);

module.exports = { str, num, int, bool, isId, nameKey, paging, escapeRegex, ApiError, bad, notFound, conflict };
