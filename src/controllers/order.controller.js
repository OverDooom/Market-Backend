const orderService = require('../services/order.service');

// CHECKOUT
exports.checkout = async (req, res, next) => {
  try {
    const { address_id } = req.body;

    if (!address_id) {
      const err = new Error('address_id is required');
      err.status = 400;
      throw err;
    }

    const order = await orderService.checkout(
      req.user.id,
      address_id
    );

    res.status(201).json(order);

  } catch (err) {
    next(err);
  }
};

// GET MY ORDERS
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await orderService.getMyOrders(req.user.id);
    res.json(orders);

  } catch (err) {
    next(err);
  }
};

// GET SINGLE ORDER
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(
      req.params.id,
      req.user.id
    );

    res.json(order);

  } catch (err) {
    next(err);
  }
};

// ADMIN UPDATE STATUS
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const order = await orderService.updateOrderStatus(
      req.params.id,
      req.body.status
    );

    res.json(order);

  } catch (err) {
    next(err);
  }
};