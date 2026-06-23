const express = require('express');
const router = express.Router();

const wishlistController = require('../controllers/wishlist.controller');
const auth = require('../middleware/auth.middleware');


router.get('/', auth, wishlistController.getWishlist);


router.post('/', auth, wishlistController.addItem);


router.get('/:productId/check', auth, wishlistController.checkItem);


router.delete('/:productId', auth, wishlistController.removeItem);


router.delete('/', auth, wishlistController.clearWishlist);

module.exports = router;
