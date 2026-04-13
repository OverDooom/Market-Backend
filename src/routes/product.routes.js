// src/routes/product.routes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const auth = require('../middleware/auth.middleware');
const role = require('../middleware/role.middleware');

////////////////////////////////////////////////////
const { generateToken } = require('../utils/jwt');


router.get('/test-token', (req, res) => {
  const token = generateToken({
    id: 1,
    role: 'admin'
  });

  res.json({ token });
});
///////////////////////////////////////////////////


// GET all products
router.get('/',auth, productController.getAllProducts);

// GET single product
router.get('/:id', productController.getProductById);

// CREATE product (admin later)
router.post('/', productController.createProduct);

// UPDATE product
router.put('/:id', productController.updateProduct);

// DELETE product
router.delete('/:id', productController.deleteProduct);

module.exports = router;