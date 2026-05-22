const express = require('express');

const router = express.Router();

const notificationController =
require('../controllers/notification.controller');

const auth =
require('../middleware/auth.middleware');

// GET MY NOTIFICATIONS
router.get(
  '/',
  auth,
  notificationController.getNotifications
);

// MARK AS READ
router.put(
  '/:id/read',
  auth,
  notificationController.markAsRead
);

// MARK ALL AS READ
router.put(
  '/read-all',
  auth,
  notificationController.markAllAsRead
);
// test only ------------------------------------------
router.post(
  '/',
  auth,
  notificationController.createNotification
);

module.exports = router;