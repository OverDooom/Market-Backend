const db = require('../config/db');

// GET all addresses for a user
exports.getAddresses = async (userId) => {
  const result = await db.query(
    `SELECT * FROM addresses WHERE user_id = $1 ORDER BY id`,
    [userId]
  );
  return result.rows;
};

// GET single address
exports.getAddressById = async (id, userId) => {
  const result = await db.query(
    `SELECT * FROM addresses WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  if (!result.rows[0]) {
    const err = new Error("Address not found");
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};

// CREATE address
exports.createAddress = async (userId, data) => {
  const { city, street, building, area } = data;

  if (!city || !street) {
    const err = new Error("city and street are required");
    err.status = 400;
    throw err;
  }

  const result = await db.query(
    `INSERT INTO addresses (user_id, city, street, building, "Area")
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, city, street, building || null, area || null]
  );

  return result.rows[0];
};

// UPDATE address
exports.updateAddress = async (id, userId, data) => {
  const existing = await db.query(
    `SELECT * FROM addresses WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  if (!existing.rows[0]) {
    const err = new Error("Address not found");
    err.status = 404;
    throw err;
  }

  const addr = existing.rows[0];

  const result = await db.query(
    `UPDATE addresses
     SET city = $1, street = $2, building = $3, "Area" = $4
     WHERE id = $5 AND user_id = $6
     RETURNING *`,
    [
      data.city     ?? addr.city,
      data.street   ?? addr.street,
      data.building ?? addr.building,
      data.area     ?? addr.Area,
      id,
      userId
    ]
  );

  return result.rows[0];
};

// DELETE address
exports.deleteAddress = async (id, userId) => {
  const result = await db.query(
    `DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId]
  );

  if (!result.rows[0]) {
    const err = new Error("Address not found");
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};
