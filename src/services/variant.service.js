const db = require('../config/db');
const { generateSKU } = require('../utils/sku');

// GET ALL variants (global)
exports.getAllVariants = async () => {
  const result = await db.query(`
    SELECT 
      v.id,
      v.sku,
      v.barcode,
      v.price,
      v.quantity,

      json_build_object(
        'id', p.id,
        'name', p.name,
        'description', p.description,
        'brand', p.brand,
        'category', json_build_object(
          'id', c.id,
          'name', c.name
        )
      ) AS product,

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

    JOIN products p 
      ON v.product_id = p.id

    LEFT JOIN categories c
      ON p.category_id = c.id

    LEFT JOIN variant_attributes va
      ON v.id = va.variant_id

    LEFT JOIN attribute_values av
      ON va.attribute_value_id = av.id

    LEFT JOIN attributes a
      ON av.attribute_id = a.id

    GROUP BY v.id, p.id, c.id
    ORDER BY v.id
  `);

  return result.rows;
};
/*
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
*/

exports.getVariantsByProduct = async (productId) => {
  const result = await db.query(`
    SELECT 
      v.id,
      v.sku,
      v.price,
      v.quantity,
      json_agg(
        json_build_object(
          'attribute', a.name,
          'value', av.value
        )
      ) AS attributes
    FROM product_variants v
    JOIN variant_attributes va ON v.id = va.variant_id
    JOIN attribute_values av ON va.attribute_value_id = av.id
    JOIN attributes a ON av.attribute_id = a.id
    WHERE v.product_id = $1
    GROUP BY v.id
  `, [productId]);

  if (result.rows.length === 0) {
    const err = new Error("Variant not found");
    err.status = 404;
    throw err;
  }

  return result.rows;
};

exports.updateVariant = async (id, data) => {
  const { barcode, price, quantity } = data;

  const result = await db.query(`
    UPDATE product_variants
    SET barcode = $1,
        price = $2,
        quantity = $3
    WHERE id = $4
    RETURNING *
  `, [barcode, price, quantity, id]);

  if (!result.rows[0]) {
    const err = new Error("Variant not found");
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};

exports.createVariant = async (data) => {
  const { product_id, barcode, price, quantity, attribute_value_ids } = data;

  // 1. Validate input
  if (!attribute_value_ids || attribute_value_ids.length === 0) {
    const err = new Error("attribute_value_ids are required");
    err.status = 400;
    throw err;
  }

  if (quantity == null || quantity < 0) {
  const err = new Error("quantity is required and must be >= 0");
  err.status = 400;
  throw err;
  }

  // 2. Check product exists
  const product = await db.query(
    `SELECT id FROM products WHERE id = $1`,
    [product_id]
  );

  if (product.rows.length === 0) {
    const err = new Error("product_id does not exist");
    err.status = 404;
    throw err;
  }

  // 3. Create variant WITHOUT SKU first
  const variantRes = await db.query(`
    INSERT INTO product_variants
    (product_id, barcode, price, quantity)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [product_id, barcode, price, quantity]);

  const variant = variantRes.rows[0];

  const existing = await db.query(`
  SELECT v.id
  FROM product_variants v
  JOIN variant_attributes va ON v.id = va.variant_id
  WHERE v.product_id = $1
  GROUP BY v.id
  HAVING ARRAY_AGG(va.attribute_value_id ORDER BY va.attribute_value_id)
         = $2
`, [product_id, attribute_value_ids]);

if (existing.rows.length > 0) {
  throw new Error("Variant already exists");
}

  // 4. Insert into variant_attributes
  for (const attrValueId of attribute_value_ids) {
    await db.query(
      `INSERT INTO variant_attributes (variant_id, attribute_value_id)
       VALUES ($1, $2)`,
      [variant.id, attrValueId]
    );
  }

  // 5. Generate SKU (after attributes exist)
  const sku = await generateSKU({
    variantId: variant.id,
    productId: product_id
  });

  // 6. Update variant with SKU
  const updated = await db.query(`
    UPDATE product_variants
    SET sku = $1
    WHERE id = $2
    RETURNING *
  `, [sku, variant.id]);

  return updated.rows[0];
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
