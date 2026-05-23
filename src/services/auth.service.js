const db = require('../config/db');
const jwt = require('../utils/jwt');
const { hashPassword, comparePassword } = require('../utils/hash');

exports.register = async ({ name, email, password }) => {
  if (!email || !password) {
    const err = new Error("Email and password are required");
    err.status = 400;
    throw err;
  }

  const existing = await db.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  if (existing.rows.length > 0) {
    const err = new Error("Email already exists");
    err.status = 400;
    throw err;
  }

  const hashed = await hashPassword(password);

  const result = await db.query(
    `INSERT INTO users (name, email, password_hash, role_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email`,
    [name, email, hashed, 1]
  );

  return result.rows[0];
};

exports.login = async ({ email, password }) => {
  if (!email || !password) {
    const err = new Error("Email and password are required");
    err.status = 400;
    throw err;
  }

  const result = await db.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  const user = result.rows[0];
  if (!user) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    throw err;
  }

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    throw err;
  }

  const roleResult = await db.query(
  "SELECT name FROM roles WHERE id = $1",
  [user.role_id]
  );

  const roleName = roleResult.rows[0].name;

  const token = jwt.generateToken({
    id: user.id,
    role: roleName
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  };
};
