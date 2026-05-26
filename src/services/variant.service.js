const db = require('../config/db');
const { generateSKU } = require('../utils/sku');
const inventoryService = require('./inventory.service');


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
        'id',          p.id,
        'name',        p.name,
        'description', p.description,
        'brand',       p.brand,
        'category', json_build_object(
          'id',   c.id,
          'name', c.name
        )
      ) AS product,

      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'attribute', a.name,
            'value',     av.value
          )
        ) FILTER (WHERE a.id IS NOT NULL),
        '[]'
      ) AS attributes

    FROM product_variants v

    JOIN products p       ON v.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN variant_attributes va ON v.id = va.variant_id
    LEFT JOIN attribute_values av   ON va.attribute_value_id = av.id
    LEFT JOIN attributes a          ON av.attribute_id = a.id

    GROUP BY v.id, p.id, c.id
    ORDER BY v.id
  `);

  return result.rows;
};


// GET variant by ID
exports.getVariantById = async (id) => {
  const result = await db.query(`
    SELECT 
      v.id,
      v.sku,
      v.barcode,
      v.price,
      v.quantity,

      json_build_object(
        'id',      p.id,
        'name',    p.name,
        'brand',   p.brand,
        'category', json_build_object(
          'id',   c.id,
          'name', c.name
        )
      ) AS product,

      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'attribute', a.name,
            'value',     av.value
          )
        ) FILTER (WHERE a.id IS NOT NULL),
        '[]'
      ) AS attributes

    FROM product_variants v

    JOIN products p       ON v.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN variant_attributes va ON v.id = va.variant_id
    LEFT JOIN attribute_values av   ON va.attribute_value_id = av.id
    LEFT JOIN attributes a          ON av.attribute_id = a.id

    WHERE v.id = $1

    GROUP BY v.id, p.id, c.id
  `, [id]);

  if (result.rows.length === 0) {
    const err = new Error('Variant not found');
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};


// GET variants by product
exports.getVariantsByProduct = async (productId) => {
  const result = await db.query(`
    SELECT 
      v.id,
      v.sku,
      v.price,
      v.quantity,

      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'attribute', a.name,
            'value',     av.value
          )
        ) FILTER (WHERE a.id IS NOT NULL),
        '[]'
      ) AS attributes

    FROM product_variants v

    LEFT JOIN variant_attributes va ON v.id = va.variant_id
    LEFT JOIN attribute_values av   ON va.attribute_value_id = av.id
    LEFT JOIN attributes a          ON av.attribute_id = a.id

    WHERE v.product_id = $1

    GROUP BY v.id
    ORDER BY v.id
  `, [productId]);

  return result.rows;
};


/**
 * Update a variant's price, barcode, and quantity.
 * If quantity changes, the delta is recorded in inventory_transactions.
 *
 * @param {number} id
 * @param {object} data      - { barcode, price, quantity }
 * @param {number} [adminId] - req.user.id, recorded in inventory ledger
 */
exports.updateVariant = async (id, data, adminId = null) => {
  const { barcode, price, quantity } = data;

  // Fetch existing quantity so we can calculate the delta
  const existing = await db.query(
    `SELECT quantity FROM product_variants WHERE id = $1`,
    [id]
  );

  if (!existing.rows[0]) {
    const err = new Error('Variant not found');
    err.status = 404;
    throw err;
  }

  const oldQuantity = existing.rows[0].quantity;

  const result = await db.query(`
    UPDATE product_variants
    SET barcode  = $1,
        price    = $2,
        quantity = $3
    WHERE id = $4
    RETURNING *
  `, [barcode, price, quantity, id]);

  if (!result.rows[0]) {
    const err = new Error('Variant not found');
    err.status = 404;
    throw err;
  }

  // Record stock movement only when quantity actually changed
  const delta = quantity - oldQuantity;

  if (delta !== 0) {
    await inventoryService.record({
      variantId:     id,
      change:        delta,
      reason:        delta > 0 ? 'restock' : 'admin_edit',
      referenceType: 'manual',
      createdBy:     adminId,
    });
  }

  return result.rows[0];
};


exports.createVariant = async (data) => {
  const { product_id, barcode, price, quantity, attribute_value_ids } = data;

  if (!attribute_value_ids || attribute_value_ids.length === 0) {
    const err = new Error('attribute_value_ids are required');
    err.status = 400;
    throw err;
  }

  if (quantity == null || quantity < 0) {
    const err = new Error('quantity is required and must be >= 0');
    err.status = 400;
    throw err;
  }

  const product = await db.query(
    `SELECT id FROM products WHERE id = $1`,
    [product_id]
  );

  if (product.rows.length === 0) {
    const err = new Error('product_id does not exist');
    err.status = 404;
    throw err;
  }

  // Check for duplicate variant (same attribute combination)
  const sorted = [...attribute_value_ids].sort((a, b) => a - b);

  const existing = await db.query(`
    SELECT v.id
    FROM product_variants v
    JOIN variant_attributes va ON v.id = va.variant_id
    WHERE v.product_id = $1
    GROUP BY v.id
    HAVING ARRAY_AGG(va.attribute_value_id ORDER BY va.attribute_value_id) = $2
  `, [product_id, sorted]);

  if (existing.rows.length > 0) {
    const err = new Error('A variant with these attributes already exists');
    err.status = 400;
    throw err;
  }

  // Create variant without SKU first
  const variantRes = await db.query(`
    INSERT INTO product_variants (product_id, barcode, price, quantity)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [product_id, barcode, price, quantity]);

  const variant = variantRes.rows[0];

  // Insert attribute links
  for (const attrValueId of attribute_value_ids) {
    await db.query(
      `INSERT INTO variant_attributes (variant_id, attribute_value_id) VALUES ($1, $2)`,
      [variant.id, attrValueId]
    );
  }

  // Generate and attach SKU
  const sku = await generateSKU({ variantId: variant.id, productId: product_id });

  const updated = await db.query(`
    UPDATE product_variants SET sku = $1 WHERE id = $2 RETURNING *
  `, [sku, variant.id]);

  return updated.rows[0];
};


exports.deleteVariant = async (id) => {
  const result = await db.query(
    `DELETE FROM product_variants WHERE id = $1 RETURNING *`,
    [id]
  );

  if (!result.rows[0]) {
    const err = new Error('Variant not found');
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};
