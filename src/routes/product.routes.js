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
    role: 'user'
  });

  res.json({ token });
});
///////////////////////////////////////////////////


// GET all products
router.get('/', productController.getAllProducts);

// GET single product
router.get('/:id', productController.getProductById);

// CREATE product (admin later)
router.post('/', auth, role('admin'), productController.createProduct);

// UPDATE product
router.put('/:id', auth, role('admin'), productController.updateProduct);

// DELETE product
router.delete('/:id', auth, role('admin'), productController.deleteProduct);

module.exports = router;