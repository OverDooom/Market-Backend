// src/routes/product.routes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

// GET all products
router.get('/', productController.getAllProducts);

// GET single product
router.get('/:id', productController.getProductById);

// CREATE product (admin later)
router.post('/', productController.createProduct);

// UPDATE product
router.put('/:id', productController.updateProduct);

// DELETE product
router.delete('/:id', productController.deleteProduct);

module.exports = router;