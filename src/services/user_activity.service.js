const db = require('../config/db');









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