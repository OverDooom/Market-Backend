const db = require('../config/db');





exports.getWishlist = async (userId) => {
  const result = await db.query(
    `SELECT
        wi.id,
        wi.created_at AS added_at,

        p.id             AS product_id,
        p.name           AS product_name,
        p.description,
        p.brand,

        json_build_object(
          'id',   c.id,
          'name', c.name
        ) AS category,

        COALESCE(
          MIN(NULLIF(v.image, '')),
          'default-product.png'
        ) AS image,

        COALESCE(MIN(v.price), 0) AS min_price,
        COALESCE(MAX(v.price), 0) AS max_price,

        CASE
          WHEN COALESCE(SUM(v.quantity), 0) > 0
          THEN true
          ELSE false
        END AS in_stock,

        ROUND(AVG(r.rating), 1)   AS average_rating,
        COUNT(DISTINCT r.id)      AS reviews_count

     FROM wishlist_items wi

     JOIN products p
       ON wi.product_id = p.id

     LEFT JOIN categories c
       ON p.category_id = c.id

     LEFT JOIN product_variants v
       ON p.id = v.product_id

     LEFT JOIN reviews r
       ON p.id = r.product_id

     WHERE wi.user_id = $1

     GROUP BY wi.id, p.id, c.id

     ORDER BY wi.created_at DESC`,
    [userId]
  );

  return result.rows;
};





exports.addItem = async (userId, productId) => {
  
  const product = await db.query(
    `SELECT id FROM products WHERE id = $1`,
    [productId]
  );

  if (product.rows.length === 0) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  
  const result = await db.query(
    `INSERT INTO wishlist_items (user_id, product_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, product_id) DO NOTHING
     RETURNING *`,
    [userId, productId]
  );

  
  if (result.rows.length === 0) {
    const existing = await db.query(
      `SELECT * FROM wishlist_items
       WHERE user_id = $1 AND product_id = $2`,
      [userId, productId]
    );
    return { ...existing.rows[0], already_exists: true };
  }

  return result.rows[0];
};





exports.removeItem = async (userId, productId) => {
  const result = await db.query(
    `DELETE FROM wishlist_items
     WHERE user_id = $1 AND product_id = $2
     RETURNING *`,
    [userId, productId]
  );

  if (!result.rows[0]) {
    const err = new Error('Item not found in wishlist');
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};





exports.clearWishlist = async (userId) => {
  await db.query(
    `DELETE FROM wishlist_items WHERE user_id = $1`,
    [userId]
  );

  return { message: 'Wishlist cleared' };
};





exports.isInWishlist = async (userId, productId) => {
  const result = await db.query(
    `SELECT 1 FROM wishlist_items
     WHERE user_id = $1 AND product_id = $2`,
    [userId, productId]
  );

  return result.rows.length > 0;
};
