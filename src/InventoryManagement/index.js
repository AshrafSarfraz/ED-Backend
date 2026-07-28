const express = require('express');
const router = express.Router();

router.use('/ingredients', require('./routes/ingredientRoutes'));
router.use('/menu-items', require('./routes/menuItemRoutes'));
router.use('/invoices', require('./routes/invoiceRoutes'));
router.use('/usage', require('./routes/usageRoutes'));

// ---- error handler (sirf is module ke liye) ----
router.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  // mongo duplicate key
  if (err && err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate record', keys: err.keyValue });
  }

  // mongoose validation
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed',
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  const status = err.status || 500;
  if (status >= 500) console.error('[inventory]', err);

  res.status(status).json({
    message: status >= 500 ? 'Server error' : err.message,
    ...(err.details ? { details: err.details } : {}),
    // stack sirf development me - production me leak nahi hoga
    ...(process.env.NODE_ENV !== 'production' && status >= 500 ? { error: err.message } : {}),
  });
});

module.exports = router;
