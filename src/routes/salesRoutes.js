const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

router.post('/', salesController.createSale);
router.get('/daily', salesController.getDailySales);
router.get('/:id', salesController.getSaleById);
router.post('/:id/cancel', salesController.cancelSale);

module.exports = router;