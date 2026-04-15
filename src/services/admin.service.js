const db = require('../config/db');

exports.getAllUsers = async () => {
  const result = await db.query(
    "SELECT id, name, email, role_id FROM users"
  );
  return result.rows;
};

exports.getUser = async (id) => {
  const result = await db.query(
    "SELECT id, name, email, phone FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0];
};

exports.deleteUser = async (id) => {
  await db.query(
    "DELETE FROM users WHERE id = $1",
    [id]
  );
};
