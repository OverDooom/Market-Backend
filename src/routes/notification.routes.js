const express = require('express');

const router = express.Router();

const notificationController = require('../controllers/notification.controller');
const auth = require('../middleware/auth.middleware');
const role = require('../middleware/role.middleware');


router.get(
  '/',
  auth,
  notificationController.getNotifications
);


router.put(
  '/read-all',
  auth,
  notificationController.markAllAsRead
);


router.put(
  '/:id/read',
  auth,
  notificationController.markAsRead
);

router.post(
  '/',
  auth,
  role(['admin']),
  notificationController.createNotification
);

module.exports = router;