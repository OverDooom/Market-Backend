const db = require('../config/db');

// CREATE NOTIFICATION
exports.createNotification = async ({
  title,
  message,
  type,
  referenceId = null,
  userIds = []
}) => {

  // 1. create notification
  const notificationRes = await db.query(
    `INSERT INTO notifications
     (
       title,
       message,
       type,
       reference_id
     )
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      title,
      message,
      type,
      referenceId
    ]
  );

  const notification =
    notificationRes.rows[0];

  // 2. attach users
  for (const userId of userIds) {

    await db.query(
      `INSERT INTO user_notifications
       (
         user_id,
         notification_id
       )
       VALUES ($1, $2)`,
      [
        userId,
        notification.id
      ]
    );
  }


    try {
      const { getIO } = require('../socket/socket');
      const io = getIO();

      for (const userId of userIds) {
        io.to(`user_${userId}`)
          .emit('notification', {
            ...notification,
            is_read: false
          });
      }
    } catch (_) {
      // socket not initialized (e.g. test environment)
    }

  return notification;
};

// GET USER NOTIFICATIONS
exports.getUserNotifications =
async (userId) => {

  const result = await db.query(
    `SELECT
        un.id AS user_notification_id,
        un.is_read,

        n.id,
        n.title,
        n.message,
        n.type,
        n.reference_id,
        n.created_at

     FROM user_notifications un

     JOIN notifications n
       ON un.notification_id = n.id

     WHERE un.user_id = $1

     ORDER BY n.created_at DESC`,
    [userId]
  );

  return result.rows;
};

// MARK AS READ
exports.markAsRead =
async (userNotificationId, userId) => {

  const result = await db.query(
    `UPDATE user_notifications
     SET is_read = true
     WHERE id = $1
     AND user_id = $2
     RETURNING *`,
    [userNotificationId, userId]
  );

  if (!result.rows[0]) {
    const err = new Error(
      'Notification not found'
    );

    err.status = 404;
    throw err;
  }

  return result.rows[0];
};

// MARK ALL AS READ
exports.markAllAsRead =
async (userId) => {

  await db.query(
    `UPDATE user_notifications
     SET is_read = true
     WHERE user_id = $1`,
    [userId]
  );

  return {
    message:
      'All notifications marked as read'
  };
};