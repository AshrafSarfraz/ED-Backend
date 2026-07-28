const express = require('express');
const router = express.Router();
const { protectBranch } = require('../../middleware/protectBranch');
const c = require('../controllers/usageController');

router.use(protectBranch);

router.get('/', c.report);

module.exports = router;
