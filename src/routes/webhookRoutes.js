const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Webhook de Mercado Pago
// IMPORTANTE: Este endpoint NO debe tener autenticación
// Mercado Pago lo llama directamente
router.post('/mercadopago', webhookController.mercadoPagoWebhook);

module.exports = router;
