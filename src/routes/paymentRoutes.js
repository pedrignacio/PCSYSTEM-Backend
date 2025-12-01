const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/create_preference', paymentController.createPreference);

module.exports = router;