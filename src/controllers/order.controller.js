const orderService = require('../services/order.service');

// CHECKOUT
exports.checkout = async (req, res, next) => {
  try {
    const { address_id } = req.body;
    const coupons = req.body.coupons || [];

    if (!Array.isArray(coupons) || coupons.some(c => typeof c !== 'string')) {
      return res.status(400).json({ error: 'coupons must be an array of strings' });
    }

    const result = await orderService.checkout({
      userId:      req.user.id,
      addressId:   address_id,
      couponCodes: coupons,
    });

    res.status(201).json(result);
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

// USER — CANCEL OWN PENDING ORDER
exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await orderService.cancelOrder(
      req.params.id,
      req.user.id
    );
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// GET STATUS HISTORY (owner or admin)
exports.getOrderHistory = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';

    const history = await orderService.getOrderHistory(
      req.params.id,
      req.user.id,
      isAdmin
    );

    res.json(history);
  } catch (err) {
    next(err);
  }
};

// ADMIN — UPDATE STATUS
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const order = await orderService.updateOrderStatus(
      req.params.id,
      status,
      req.user.id,     // adminId — recorded in history
      notes || null
    );

    res.json(order);
  } catch (err) {
    next(err);
  }
};
