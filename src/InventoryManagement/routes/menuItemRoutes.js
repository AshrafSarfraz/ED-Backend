const express = require('express');
const router = express.Router();
const { protectBranch } = require('../../middleware/protectBranch');
const { uploadImage } = require('../../middleware/multer');
const c = require('../controllers/menuItemController');

router.use(protectBranch);

// uploadImage sirf multipart request pe chalta hai - purani JSON calls
// bilkul waise hi guzar jati hain, isliye photo dena optional hai.
router.get('/', c.list);
router.post('/', uploadImage.single('image'), c.create);
router.get('/:id', c.getOne);
router.put('/:id', uploadImage.single('image'), c.update);
router.delete('/:id', c.remove);

module.exports = router;