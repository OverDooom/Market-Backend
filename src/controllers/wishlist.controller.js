const wishlistService = require('../services/wishlist.service');

// GET WISHLIST
exports.getWishlist = async (req, res, next) => {
  try {
    const items = await wishlistService.getWishlist(req.user.id);
    res.json(items);
  } catch (err) {
    next(err);
  }
};

// ADD ITEM
exports.addItem = async (req, res, next) => {
  try {
    const productId = parseInt(req.body.product_id);

    if (!productId || isNaN(productId)) {
      const err = new Error('product_id is required and must be a number');
      err.status = 400;
      throw err;
    }

    const item = await wishlistService.addItem(req.user.id, productId);
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
};

// REMOVE ITEM
exports.removeItem = async (req, res, next) => {
  try {
    const productId = parseInt(req.params.productId);

    if (isNaN(productId)) {
      const err = new Error('Invalid product id');
      err.status = 400;
      throw err;
    }

    const item = await wishlistService.removeItem(req.user.id, productId);
    res.json(item);
  } catch (err) {
    next(err);
  }
};

// CLEAR WISHLIST
exports.clearWishlist = async (req, res, next) => {
  try {
    const result = await wishlistService.clearWishlist(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// CHECK IF PRODUCT IS IN WISHLIST
exports.checkItem = async (req, res, next) => {
  try {
    const productId = parseInt(req.params.productId);

    if (isNaN(productId)) {
      const err = new Error('Invalid product id');
      err.status = 400;
      throw err;
    }

    const inWishlist = await wishlistService.isInWishlist(
      req.user.id,
      productId
    );

    res.json({ product_id: productId, in_wishlist: inWishlist });
  } catch (err) {
    next(err);
  }
};
