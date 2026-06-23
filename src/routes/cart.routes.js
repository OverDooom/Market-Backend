const express = require('express');
const router = express.Router();

const cartController = require('../controllers/cart.controller');
const auth = require('../middleware/auth.middleware');

router.get('/', auth, cartController.getCart);

router.post('/items', auth, cartController.addItem);

router.delete('/items/:itemId', auth, cartController.removeItem);

router.delete('/', auth, cartController.clearCart);

module.exports = router;