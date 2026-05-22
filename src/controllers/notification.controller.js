const notificationService =
require('../services/notification.service');

// GET USER NOTIFICATIONS
exports.getNotifications =
async (req, res, next) => {
  try {

    const notifications =
      await notificationService
      .getUserNotifications(req.user.id);

    res.json(notifications);

  } catch (err) {
    next(err);
  }
};

// MARK AS READ
exports.markAsRead =
async (req, res, next) => {
  try {

    const notification =
      await notificationService
      .markAsRead(
        req.params.id,
        req.user.id
      );

    res.json(notification);

  } catch (err) {
    next(err);
  }
};

// MARK ALL AS READ
exports.markAllAsRead =
async (req, res, next) => {
  try {

    const result =
      await notificationService
      .markAllAsRead(req.user.id);

    res.json(result);

  } catch (err) {
    next(err);
  }
};
// test only ------------------------------------------
exports.createNotification =
async (req, res, next) => {
  try {

    const notification =
      await notificationService
      .createNotification(req.body);

    res.status(201).json(notification);

  } catch (err) {
    next(err);
  }
};