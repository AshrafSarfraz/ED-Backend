const express = require('express');
const router = express.Router();
const { protectBranch } = require('../../middleware/protectBranch');
const c = require('../controllers/menuItemController');

router.use(protectBranch);

router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.getOne);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;
