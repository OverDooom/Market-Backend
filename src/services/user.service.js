const db = require('../config/db');

exports.getProfile = async (userId) => {
  const result = await db.query(
    "SELECT id, name, email, phone FROM users WHERE id = $1",
    [userId]
  );

  return result.rows[0];
};

exports.updateProfile = async (userId, data) => {
  const existing = await db.query(
  "SELECT * FROM users WHERE id = $1",
  [userId]
  );

  if (!existing.rows[0]) {
      const err = new Error("User doesn't exist");
      err.status = 404;
      throw err;
    }
  const user = existing.rows[0];

  const result = await db.query(
    `UPDATE users
    SET name = $1, phone = $2
    WHERE id = $3
    RETURNING id, name, email, phone`,
    [
      data.name ?? user.name,
      data.phone ?? user.phone,
      userId
    ]
  );

  return result.rows[0];
};
