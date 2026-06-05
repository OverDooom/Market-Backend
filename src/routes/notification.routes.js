const express = require('express');

const router = express.Router();

const notificationController = require('../controllers/notification.controller');
const auth = require('../middleware/auth.middleware');
const role = require('../middleware/role.middleware');

// GET MY NOTIFICATIONS
router.get(
  '/',
  auth,
  notificationController.getNotifications
);

// MARK ALL AS READ
router.put(
  '/read-all',
  auth,
  notificationController.markAllAsRead
);

// MARK AS READ
router.put(
  '/:id/read',
  auth,
  notificationController.markAsRead
);
// test only ------------------------------------------
router.post(
  '/',
  auth,
  role(['admin']),
  notificationController.createNotification
);

module.exports = router;