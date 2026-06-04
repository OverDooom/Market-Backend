// src/routes/product.routes.js
const express = require('express');
const router = express.Router();

const productController = require('../controllers/product.controller');
const variantController = require('../controllers/variant.controller');
const auth = require('../middleware/auth.middleware');
const role = require('../middleware/role.middleware');




// VARIANTS

// GET all variants
router.get('/variants', variantController.getAllVariants);

// GET all variants for product
router.get('/:productId/variants', variantController.getVariantsByProduct);

// CREATE variant
router.post('/:productId/variants', auth, role(['admin']), variantController.createVariant);

// UPDATE variant
router.put('/:productId/variants/:variantId', auth, role(['admin']), variantController.updateVariant);

// DELETE variant
router.delete('/:productId/variants/:variantId', auth, role(['admin']), variantController.deleteVariant);

//Products 

// GET all products
router.get('/', productController.getAllProducts);

// GET single product
router.get('/:id', productController.getProductById);

// CREATE product (admin later)
router.post('/', auth, role(['admin']), productController.createProduct);

// UPDATE product
router.put('/:id', auth, role(['admin']), productController.updateProduct);

// DELETE product
router.delete('/:id', auth, role(['admin']), productController.deleteProduct);


module.exports = router;