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
  if (!result) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }
  
  return result.rows[0];
};

exports.deleteUser = async (id) => {
  const result = await db.query(
    "DELETE FROM users WHERE id = $1 RETURNING *",
    [id]
  );
  if (!result.rows[0]) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};
