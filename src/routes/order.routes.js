const express = require('express');
const router = express.Router();

const orderController = require('../controllers/order.controller');
const auth = require('../middleware/auth.middleware');
const role = require('../middleware/role.middleware');


router.post('/checkout', auth, orderController.checkout);


router.get('/', auth, orderController.getMyOrders);


router.get('/:id', auth, orderController.getOrderById);


router.get('/:id/history', auth, orderController.getOrderHistory);


router.post('/:id/cancel', auth, orderController.cancelOrder);



router.put(
  '/:id/status',
  auth,
  role(['admin']),
  orderController.updateOrderStatus
);

module.exports = router;