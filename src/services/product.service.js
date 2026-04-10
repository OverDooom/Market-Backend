// src/services/product.service.js
const db = require('../config/db');

exports.getAllProducts = async () => {
  const result = await db.query(`
    SELECT p.*, c.name AS category
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
  `);

  return result.rows;
};

exports.getProductById = async (id) => {
  const result = await db.query(`
    SELECT p.*, c.name AS category
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = $1
  `, [id]);

  return result.rows[0];
};

exports.getProductWithVariants = async (id) => {
  const product = await db.query(`
    SELECT * FROM products WHERE id=$1
  `, [id]);

  const variants = await db.query(`
    SELECT * FROM product_variants WHERE product_id=$1
  `, [id]);

  return {
    ...product.rows[0],
    variants: variants.rows
  };
};

exports.createProduct = async (data) => {
  const { name, description, brand, category_id } = data;

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

  return result.rows[0];
};

exports.deleteProduct = async (id) => {
  await db.query(`DELETE FROM products WHERE id=$1`, [id]);
};