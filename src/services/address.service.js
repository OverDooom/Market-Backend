const db = require('../config/db');
const { requireStr, optionalStr } = require('../utils/sanitize');

exports.getAddresses = async (userId) => {
  const result = await db.query(
    `SELECT * FROM addresses WHERE user_id = $1 ORDER BY id`,
    [userId]
  );
  return result.rows;
};

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

exports.createAddress = async (userId, data) => {
  const city     = requireStr(data.city,     'city',     100);
  const street   = requireStr(data.street,   'street',   200);
  const building = optionalStr(data.building, 'building', 100);
  const area     = optionalStr(data.area,     'area',     100);

  const result = await db.query(
    `INSERT INTO addresses (user_id, city, street, building, "Area")
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, city, street, building, area]
  );

  return result.rows[0];
};

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

  
  const city     = data.city     !== undefined
    ? requireStr(data.city,      'city',     100)
    : addr.city;

  const street   = data.street   !== undefined
    ? requireStr(data.street,    'street',   200)
    : addr.street;

  const building = data.building !== undefined
    ? optionalStr(data.building, 'building', 100)
    : addr.building;

  const area     = data.area     !== undefined
    ? optionalStr(data.area,     'area',     100)
    : addr.Area;

  const result = await db.query(
    `UPDATE addresses
     SET city = $1, street = $2, building = $3, "Area" = $4
     WHERE id = $5 AND user_id = $6
     RETURNING *`,
    [city, street, building, area, id, userId]
  );

  return result.rows[0];
};

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