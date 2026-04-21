const db = require('../config/db');

// GET ALL variants (global)
exports.getAllVariants = async () => {
  const result = await db.query(`
    SELECT v.*, p.name AS product_name
    FROM product_variants v
    LEFT JOIN products p ON v.product_id = p.id
    ORDER BY v.id
  `);

  return result.rows;
};


// GET variant by ID
exports.getVariantById = async (id) => {
  const result = await db.query(`
    SELECT v.*, p.name AS product_name
    FROM product_variants v
    LEFT JOIN products p ON v.product_id = p.id
    WHERE v.id = $1
  `, [id]);

  if (result.rows.length === 0) {
    const err = new Error("Variant not found");
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};


// GET variants by product
exports.getVariantsByProduct = async (productId) => {
  const result = await db.query(
    `SELECT * FROM product_variants WHERE product_id = $1`,
    [productId]
  );

  return result.rows;
};


// CREATE variant
exports.createVariant = async (data) => {
  const { product_id, sku, barcode, price, quantity } = data;

  // check product exists
  const product = await db.query(
    `SELECT id FROM products WHERE id = $1`,
    [product_id]
  );

  if (product.rows.length === 0) {
    const err = new Error("product_id does not exist");
    err.status = 404;
    throw err;
  }

  const result = await db.query(`
    INSERT INTO product_variants
    (product_id, sku, barcode, price, quantity)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [product_id, sku, barcode, price, quantity]);

  return result.rows[0];
};


// UPDATE variant
exports.updateVariant = async (id, data) => {
  const { sku, barcode, price, quantity } = data;

  const result = await db.query(`
    UPDATE product_variants
    SET sku = $1,
        barcode = $2,
        price = $3,
        quantity = $4
    WHERE id = $5
    RETURNING *
  `, [sku, barcode, price, quantity, id]);

  if (!result.rows[0]) {
    const err = new Error("Variant not found");
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};


// DELETE variant
exports.deleteVariant = async (id) => {
  const result = await db.query(
    `DELETE FROM product_variants WHERE id = $1 RETURNING *`,
    [id]
  );

  if (!result.rows[0]) {
    const err = new Error("Variant not found");
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};
