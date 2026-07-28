const express = require('express');
const router = express.Router();
const { protectBranch } = require('../../middleware/protectBranch');
const c = require('../controllers/ingredientController');
const { csvUpload } = require('../utils/upload');

router.use(protectBranch);           // har route branch-protected

router.get('/template', c.template);
router.post('/bulk', csvUpload, c.bulkUpload);

router.get('/', c.list);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;
