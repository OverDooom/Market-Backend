// src/services/product.service.js
const db = require('../config/db');

/*exports.getAllProducts = async ({ page, limit, search, category }) => {
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
};*/
exports.getAllProducts = async ({ page = 1, limit = 10, search, category }) => {
  const offset = (page - 1) * limit;

  const values = [];
  const conditions = [];

  let query = `
    SELECT 
      p.id,
      p.name,
      p.description,
      p.brand,
      p.created_at,

      COALESCE(
        MIN(NULLIF(v.image, '')),
        'default-product.png'
      ) AS image,

      json_build_object(
        'id', c.id,
        'name', c.name
      ) AS category,

      COALESCE(MIN(v.price), 0) AS min_price,
      COALESCE(MAX(v.price), 0) AS max_price,

      COALESCE(SUM(v.quantity), 0) AS total_stock,

      COUNT(v.id) AS variants_count,

      CASE
        WHEN COALESCE(SUM(v.quantity), 0) > 0
        THEN true
        ELSE false
      END AS in_stock

    FROM products p

    LEFT JOIN categories c
      ON p.category_id = c.id

    LEFT JOIN product_variants v
      ON p.id = v.product_id
  `;

  // SEARCH
  if (search) {
    values.push(`%${search}%`);

    conditions.push(`
      (
        p.name ILIKE $${values.length}
        OR p.description ILIKE $${values.length}
        OR p.brand ILIKE $${values.length}
      )
    `);
  }

  // CATEGORY FILTER
  if (category) {
    values.push(category);

    conditions.push(`
      p.category_id = $${values.length}
    `);
  }

  // APPLY CONDITIONS
  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(' AND ');
  }

  query += `
    GROUP BY p.id, c.id
    ORDER BY p.id
  `;

  // PAGINATION
  values.push(limit);
  values.push(offset);
 
  
  query += `
    LIMIT $${values.length - 1}
    OFFSET $${values.length}
  `;

  const result = await db.query(query, values);

  return result.rows;
};


exports.getProductById = async (id) => {
  // 1. Get product
  const productResult = await db.query(`
    SELECT 
      p.id,
      p.name,
      p.description,
      p.brand,
      p.created_at,

      json_build_object(
        'id', c.id,
        'name', c.name
      ) AS category

    FROM products p

    LEFT JOIN categories c
      ON p.category_id = c.id

    WHERE p.id = $1
  `, [id]);

  if (productResult.rows.length === 0) {
    const err = new Error("Product not found");
    err.status = 404;
    throw err;
  }

  const product = productResult.rows[0];

  // 2. Get variants
  const variantsResult = await db.query(`
    SELECT 
      v.id,
      v.sku,
      v.barcode,
      v.price,
      v.quantity,

      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'attribute', a.name,
            'value', av.value
          )
        ) FILTER (WHERE a.id IS NOT NULL),
        '[]'
      ) AS attributes

    FROM product_variants v

    LEFT JOIN variant_attributes va
      ON v.id = va.variant_id

    LEFT JOIN attribute_values av
      ON va.attribute_value_id = av.id

    LEFT JOIN attributes a
      ON av.attribute_id = a.id

    WHERE v.product_id = $1

    GROUP BY v.id
    ORDER BY v.id
  `, [id]);

  // 3. Attach variants
  product.variants = variantsResult.rows;

  return product;
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