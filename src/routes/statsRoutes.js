const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

router.get('/cupones', statsController.getCouponsStats);
router.get('/packs', statsController.getPacksStats);
router.get('/descuentos', statsController.getDiscountsStats);

module.exports = router;