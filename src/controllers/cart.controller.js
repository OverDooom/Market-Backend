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

    const cart = await cartService.getOrCreateCart(req.user.id);

    const item = await cartService.addItem(
      cart.id,
      variant_id,
      quantity
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