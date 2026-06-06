const db = require('../config/db');
const { optionalStr, validatePhone } = require('../utils/sanitize');

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

  const cleanName  = data.name  !== undefined
    ? optionalStr(data.name,  'name',  100)
    : user.name;

  const cleanPhone = data.phone !== undefined
    ? validatePhone(data.phone, 'phone')
    : user.phone;

  const result = await db.query(
    `UPDATE users
     SET name = $1, phone = $2
     WHERE id = $3
     RETURNING id, name, email, phone`,
    [cleanName ?? user.name, cleanPhone, userId]
  );

  return result.rows[0];
};