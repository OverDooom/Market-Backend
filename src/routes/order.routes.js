const express = require('express');
const router = express.Router();

const orderController = require('../controllers/order.controller');
const auth = require('../middleware/auth.middleware');
const role = require('../middleware/role.middleware');

// CHECKOUT
router.post('/checkout', auth, orderController.checkout);

// GET MY ORDERS
router.get('/', auth, orderController.getMyOrders);

// GET SINGLE ORDER
router.get('/:id', auth, orderController.getOrderById);

// ADMIN UPDATE STATUS
router.put(
  '/:id/status',
  auth,
  role(['admin']),
  orderController.updateOrderStatus
);

module.exports = router;