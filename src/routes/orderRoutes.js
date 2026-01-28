const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Crear orden (desde checkout)
router.post('/', orderController.createOrder);

// Obtener todas las órdenes (con paginación y filtros)
router.get('/', orderController.getAllOrders);

// Obtener orden por ID
router.get('/:id', orderController.getOrderById);

// Actualizar estado de orden
router.patch('/:id/status', orderController.updateOrderStatus);

// Obtener historial de cambios de una orden
router.get('/:id/history', orderController.getOrderHistory);

module.exports = router;
