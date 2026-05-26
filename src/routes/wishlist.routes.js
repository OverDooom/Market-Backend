const express = require('express');
const router = express.Router();

const wishlistController = require('../controllers/wishlist.controller');
const auth = require('../middleware/auth.middleware');

// GET my wishlist
router.get('/', auth, wishlistController.getWishlist);

// ADD item to wishlist
router.post('/', auth, wishlistController.addItem);

// CHECK if a specific product is in wishlist
router.get('/:productId/check', auth, wishlistController.checkItem);

// REMOVE item from wishlist
router.delete('/:productId', auth, wishlistController.removeItem);

// CLEAR entire wishlist
router.delete('/', auth, wishlistController.clearWishlist);

module.exports = router;
