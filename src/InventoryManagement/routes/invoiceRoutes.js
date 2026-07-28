const express = require('express');
const router = express.Router();
const { protectBranch } = require('../../middleware/protectBranch');
const c = require('../controllers/invoiceController');

router.use(protectBranch);

router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.getOne);

module.exports = router;
