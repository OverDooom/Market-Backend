const orderService = require('../services/order.service');


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


exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await orderService.getMyOrders(req.user.id);
    res.json(orders);
  } catch (err) {
    next(err);
  }
};


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


exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const order = await orderService.updateOrderStatus(
      req.params.id,
      status,
      req.user.id,     
      notes || null
    );

    res.json(order);
  } catch (err) {
    next(err);
  }
};
