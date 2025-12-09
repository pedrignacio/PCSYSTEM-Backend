const express = require('express');
const router = express.Router();
const haulmerController = require('../controllers/haulmerController');

router.post('/payment', haulmerController.createPayment);
router.get('/payment/:token', haulmerController.checkPaymentStatus);

module.exports = router;
