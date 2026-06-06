const db = require('../config/db');

/**
 * Record a user action.
 * Fire-and-forget — never throws, so a logging failure
 * never breaks the real request.
 *
 * @param {number} userId
 * @param {string} action  e.g. 'login', 'logout', 'place_order', 'cancel_order'
 */
exports.record = async (userId, action) => {
  try {
    await db.query(
      `INSERT INTO user_activity (user_id, action) VALUES ($1, $2)`,
      [userId, action]
    );
  } catch (err) {
    console.error('[user_activity] failed to record:', err.message);
  }
};