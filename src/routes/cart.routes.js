const express = require('express');
const router = express.Router();

const cartController = require('../controllers/cart.controller');
const auth = require('../middleware/auth.middleware');

// GET CART
router.get('/', auth, cartController.getCart);

// ADD ITEM
router.post('/items', auth, cartController.addItem);

// REMOVE ITEM
router.delete('/items/:itemId', auth, cartController.removeItem);

// CLEAR CART
router.delete('/', auth, cartController.clearCart);

module.exports = router;