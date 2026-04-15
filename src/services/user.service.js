const db = require('../config/db');

exports.getProfile = async (userId) => {
  const result = await db.query(
    "SELECT id, name, email, phone FROM users WHERE id = $1",
    [userId]
  );

  return result.rows[0];
};

exports.updateProfile = async (userId, data) => {
  const { name, phone } = data;

  const result = await db.query(
    `UPDATE users
     SET name = $1, phone = $2
     WHERE id = $3
     RETURNING id, name, email, phone`,
    [name, phone, userId]
  );

  return result.rows[0];
};
