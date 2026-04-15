// src/services/product.service.js
const db = require('../config/db');

exports.getAllProducts = async ({ page, limit, search, category }) => {
  const offset = (page - 1) * limit;

  let query = `
    SELECT p.*, c.name AS category
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
  `;

  const values = [];
  let conditions = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`p.name ILIKE $${values.length}`);
  }

  if (category) {
    values.push(category);
    conditions.push(`p.category_id = $${values.length}`);
  }

  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(' AND ');
  }

  values.push(limit);
  values.push(offset);

  query += ` LIMIT $${values.length - 1} OFFSET $${values.length}`;

  const result = await db.query(query, values);

  return result.rows;
};

exports.getProductById = async (id) => {
  const result = await db.query(`
    SELECT p.*, c.name AS category
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = $1
  `, [id]);

  if (result.rows.length === 0) {
    const err = new Error("Product not found");
    err.status = 404;
    throw err;
  }
  return result.rows[0];
};

exports.createProduct = async (data) => {
  const { name, description, brand, category_id } = data;

  const categoryCheck = await db.query(
    `SELECT id FROM categories WHERE id=$1`,
    [category_id]
  );

  if (categoryCheck.rows.length === 0) {
    const err = new Error("category_id does not exist");
    err.status = 404; 
    throw err;
  }

  const result = await db.query(`
    INSERT INTO products (name, description, brand, category_id)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [name, description, brand, category_id]);

  return result.rows[0];
};

exports.updateProduct = async (id, data) => {
  const { name, description, brand, category_id } = data;

  const result = await db.query(`
    UPDATE products
    SET name=$1, description=$2, brand=$3, category_id=$4
    WHERE id=$5
    RETURNING *
  `, [name, description, brand, category_id, id]);
  return result.rows[0]; // undefined if not found
};

exports.deleteProduct = async (id) => {
  const result = await db.query(
    `DELETE FROM products WHERE id=$1 RETURNING *`,
    [id]
  );

  return result.rows[0]; // undefined if not found
};