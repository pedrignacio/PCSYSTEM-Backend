const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/create_preference', paymentController.createPreference);
router.get('/mp_account', paymentController.getMercadoPagoAccount);

module.exports = router;