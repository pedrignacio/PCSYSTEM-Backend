const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Rutas de búsqueda y filtros (ANTES de /:id)
router.get('/search', productController.search);
router.get('/categories', productController.getCategories);
router.get('/low-stock', productController.getLowStock);
router.get('/top-selling', productController.getTopSelling);
router.get('/featured', productController.getFeatured);
router.put('/positions', productController.updatePositions);

// Rutas de productos individuales
router.get('/:id/related', productController.getRelated);
router.get('/:id', productController.getById);
router.get('/', productController.getAll);
router.post('/', productController.create);
router.put('/:id', productController.update);
router.delete('/:id', productController.remove);

module.exports = router;