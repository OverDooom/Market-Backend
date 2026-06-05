const cartService = require('../services/cart.service');

// GET CART
exports.getCart = async (req, res, next) => {
  try {
    const cart = await cartService.getCart(req.user.id);
    res.json(cart);
  } catch (err) {
    next(err);
  }
};

// ADD ITEM
exports.addItem = async (req, res, next) => {
  try {
    const { variant_id, quantity } = req.body;

    if (!variant_id || isNaN(parseInt(variant_id))) {
      const err = new Error('variant_id is required and must be a number');
      err.status = 400;
      throw err;
    }

    if (!quantity || parseInt(quantity) <= 0 || isNaN(parseInt(quantity))) {
      const err = new Error('quantity is required and must be a positive number');
      err.status = 400;
      throw err;
    }

    const cart = await cartService.getOrCreateCart(req.user.id);

    const item = await cartService.addItem(
      cart.id,
      parseInt(variant_id),
      parseInt(quantity)
    );

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
};

// REMOVE ITEM
exports.removeItem = async (req, res, next) => {
  try {
    const cart = await cartService.getOrCreateCart(req.user.id);

    const item = await cartService.removeItem(
      cart.id,
      req.params.itemId
    );

    res.json(item);
  } catch (err) {
    next(err);
  }
};

// CLEAR CART
exports.clearCart = async (req, res, next) => {
  try {
    const cart = await cartService.getOrCreateCart(req.user.id);

    await cartService.clearCart(cart.id);

    res.json({ message: "Cart cleared" });
  } catch (err) {
    next(err);
  }
};