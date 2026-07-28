// har controller ko wrap karta hai -> try/catch ki zaroorat nahi
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
