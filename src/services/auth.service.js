const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('../utils/jwt');

exports.register = async ({ name, email, password }) => {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const existing = await db.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  if (existing.rows.length > 0) {
    throw new Error("Email already exists");
  }

  const hashed = await bcrypt.hash(password, 10);

  // make sure role_id = 1 exists as "user"
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
    throw new Error("Email and password are required");
  }

  const result = await db.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  const user = result.rows[0];
  if (!user) throw new Error("Invalid credentials");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error("Invalid credentials");

  const token = jwt.generateToken({
    id: user.id,
    role_id: user.role_id,
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
