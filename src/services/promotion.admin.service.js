const db = require('../config/db');






async function enrichPromotion(promo) {
  const [coupons, products, categories, users, usageRes] = await Promise.all([

    db.query(
      `SELECT id, code, expires_at, usage_limit, is_active, created_at
       FROM promotion_coupons
       WHERE promotion_id = $1
       ORDER BY created_at DESC`,
      [promo.id]
    ),

    db.query(
      `SELECT pp.product_id, p.name AS product_name
       FROM promotion_products pp
       JOIN products p ON pp.product_id = p.id
       WHERE pp.promotion_id = $1`,
      [promo.id]
    ),

    db.query(
      `SELECT pc.category_id, c.name AS category_name
       FROM promotion_categories pc
       JOIN categories c ON pc.category_id = c.id
       WHERE pc.promotion_id = $1`,
      [promo.id]
    ),

    db.query(
      `SELECT pu.user_id, u.name AS user_name, u.email
       FROM promotion_users pu
       JOIN users u ON pu.user_id = u.id
       WHERE pu.promotion_id = $1`,
      [promo.id]
    ),

    db.query(
      `SELECT COUNT(*)::INTEGER AS total_uses,
              COALESCE(SUM(discount_amount), 0) AS total_discount
       FROM promotion_usage
       WHERE promotion_id = $1`,
      [promo.id]
    ),
  ]);

  return {
    ...promo,
    coupons:     coupons.rows,
    products:    products.rows,
    categories:  categories.rows,
    users:       users.rows,
    usage_stats: usageRes.rows[0],
  };
}


async function replaceTargeting(client, promotionId, table, column, ids = []) {
  await client.query(
    `DELETE FROM ${table} WHERE promotion_id = $1`,
    [promotionId]
  );

  for (const id of ids) {
    await client.query(
      `INSERT INTO ${table} (promotion_id, ${column}) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [promotionId, id]
    );
  }
}





exports.listPromotions = async ({ active } = {}) => {
  const conditions = [];
  const values     = [];

  if (active !== undefined) {
    values.push(active);
    conditions.push(`p.is_active = $${values.length}`);
  }

  const where = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const result = await db.query(
    `SELECT
        p.*,
        COUNT(DISTINCT pc.id)::INTEGER        AS coupon_count,
        COUNT(DISTINCT pu.id)::INTEGER         AS total_uses,
        COALESCE(SUM(pu.discount_amount), 0)  AS total_discount_given
     FROM promotions p
     LEFT JOIN promotion_coupons pc ON pc.promotion_id = p.id
     LEFT JOIN promotion_usage   pu ON pu.promotion_id = p.id
     ${where}
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    values
  );

  return result.rows;
};

// =========================================
// GET SINGLE PROMOTION (full detail)
// =========================================

exports.getPromotion = async (id) => {
  const result = await db.query(
    `SELECT * FROM promotions WHERE id = $1`,
    [id]
  );

  if (!result.rows[0]) {
    const err = new Error('Promotion not found');
    err.status = 404;
    throw err;
  }

  return enrichPromotion(result.rows[0]);
};

























exports.createPromotion = async (data) => {
  const {
    name,
    type,
    value,
    is_active        = true,
    is_automatic     = false,
    stackable        = false,
    coupon_required  = true,
    start_date       = null,
    end_date         = null,
    usage_limit      = null,
    usage_per_user   = null,
    min_cart_total   = null,
    first_order_only = false,
    product_ids      = [],
    category_ids     = [],
    user_ids         = [],
    coupons          = [],
  } = data;

  
  if (!name || !type || value === undefined) {
    const err = new Error('name, type, and value are required');
    err.status = 400;
    throw err;
  }

  if (!['percentage', 'fixed'].includes(type)) {
    const err = new Error("type must be 'percentage' or 'fixed'");
    err.status = 400;
    throw err;
  }

  if (Number(value) < 0) {
    const err = new Error('value must be >= 0');
    err.status = 400;
    throw err;
  }

  if (type === 'percentage' && Number(value) > 100) {
    const err = new Error('percentage value cannot exceed 100');
    err.status = 400;
    throw err;
  }

  
  const codes = coupons.map(c => c.code?.trim().toUpperCase()).filter(Boolean);
  if (new Set(codes).size !== codes.length) {
    const err = new Error('Duplicate coupon codes in request');
    err.status = 400;
    throw err;
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    
    const promoRes = await client.query(
      `INSERT INTO promotions (
         name, type, value,
         is_active, is_automatic, stackable, coupon_required,
         start_date, end_date,
         usage_limit, usage_per_user,
         min_cart_total, first_order_only
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        name, type, value,
        is_active, is_automatic, stackable, coupon_required,
        start_date, end_date,
        usage_limit, usage_per_user,
        min_cart_total, first_order_only,
      ]
    );

    const promo = promoRes.rows[0];

    
    await replaceTargeting(client, promo.id, 'promotion_products',   'product_id',  product_ids);
    await replaceTargeting(client, promo.id, 'promotion_categories', 'category_id', category_ids);
    await replaceTargeting(client, promo.id, 'promotion_users',      'user_id',     user_ids);

    
    for (const coupon of coupons) {
      if (!coupon.code) {
        const err = new Error('Each coupon must have a code');
        err.status = 400;
        throw err;
      }

      await client.query(
        `INSERT INTO promotion_coupons
           (promotion_id, code, usage_limit, expires_at, is_active)
         VALUES ($1, $2, $3, $4, true)`,
        [
          promo.id,
          coupon.code.trim().toUpperCase(),
          coupon.usage_limit || null,
          coupon.expires_at  || null,
        ]
      );
    }

    await client.query('COMMIT');

    return exports.getPromotion(promo.id);

  } catch (err) {
    await client.query('ROLLBACK');
    
    if (err.code === '23505' && err.constraint?.includes('promotion_coupons')) {
      const e = new Error('A coupon with that code already exists');
      e.status = 400;
      throw e;
    }
    throw err;
  } finally {
    client.release();
  }
};










exports.updatePromotion = async (id, data) => {
  
  const existing = await db.query(
    `SELECT * FROM promotions WHERE id = $1`,
    [id]
  );

  if (!existing.rows[0]) {
    const err = new Error('Promotion not found');
    err.status = 404;
    throw err;
  }

  const promo = existing.rows[0];

  const {
    name             = promo.name,
    type             = promo.type,
    value            = promo.value,
    is_active        = promo.is_active,
    is_automatic     = promo.is_automatic,
    stackable        = promo.stackable,
    coupon_required  = promo.coupon_required,
    start_date       = promo.start_date,
    end_date         = promo.end_date,
    usage_limit      = promo.usage_limit,
    usage_per_user   = promo.usage_per_user,
    min_cart_total   = promo.min_cart_total,
    first_order_only = promo.first_order_only,
    product_ids,    
    category_ids,
    user_ids,
  } = data;

  if (!['percentage', 'fixed'].includes(type)) {
    const err = new Error("type must be 'percentage' or 'fixed'");
    err.status = 400;
    throw err;
  }

  if (Number(value) < 0) {
    const err = new Error('value must be >= 0');
    err.status = 400;
    throw err;
  }

  if (type === 'percentage' && Number(value) > 100) {
    const err = new Error('percentage value cannot exceed 100');
    err.status = 400;
    throw err;
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE promotions
       SET name=$1, type=$2, value=$3,
           is_active=$4, is_automatic=$5, stackable=$6, coupon_required=$7,
           start_date=$8, end_date=$9,
           usage_limit=$10, usage_per_user=$11,
           min_cart_total=$12, first_order_only=$13
       WHERE id=$14`,
      [
        name, type, value,
        is_active, is_automatic, stackable, coupon_required,
        start_date, end_date,
        usage_limit, usage_per_user,
        min_cart_total, first_order_only,
        id,
      ]
    );

    
    if (product_ids  !== undefined)
      await replaceTargeting(client, id, 'promotion_products',   'product_id',  product_ids);
    if (category_ids !== undefined)
      await replaceTargeting(client, id, 'promotion_categories', 'category_id', category_ids);
    if (user_ids     !== undefined)
      await replaceTargeting(client, id, 'promotion_users',      'user_id',     user_ids);

    await client.query('COMMIT');

    return exports.getPromotion(id);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};





exports.togglePromotion = async (id) => {
  const result = await db.query(
    `UPDATE promotions
     SET is_active = NOT is_active
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  if (!result.rows[0]) {
    const err = new Error('Promotion not found');
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};





exports.deletePromotion = async (id) => {
  
  const usageRes = await db.query(
    `SELECT COUNT(*)::INTEGER AS count
     FROM promotion_usage
     WHERE promotion_id = $1`,
    [id]
  );

  if (usageRes.rows[0].count > 0) {
    const err = new Error(
      `Cannot delete a promotion that has been used ${usageRes.rows[0].count} time(s). ` +
      `Deactivate it instead.`
    );
    err.status = 409;
    throw err;
  }

  const result = await db.query(
    `DELETE FROM promotions WHERE id = $1 RETURNING *`,
    [id]
  );

  if (!result.rows[0]) {
    const err = new Error('Promotion not found');
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};





exports.getUsageStats = async (id) => {
  
  const promoRes = await db.query(
    `SELECT id, name FROM promotions WHERE id = $1`,
    [id]
  );

  if (!promoRes.rows[0]) {
    const err = new Error('Promotion not found');
    err.status = 404;
    throw err;
  }

  const [summary, breakdown] = await Promise.all([
    db.query(
      `SELECT
          COUNT(*)::INTEGER              AS total_uses,
          COUNT(DISTINCT user_id)::INTEGER AS unique_users,
          COUNT(DISTINCT order_id)::INTEGER AS orders_affected,
          COALESCE(SUM(discount_amount), 0) AS total_discount_given,
          COALESCE(AVG(discount_amount), 0) AS avg_discount_per_use
       FROM promotion_usage
       WHERE promotion_id = $1`,
      [id]
    ),

    db.query(
      `SELECT
          pu.id,
          pu.discount_amount,
          pu.created_at,

          json_build_object('id', u.id, 'name', u.name, 'email', u.email) AS user,

          json_build_object(
            'id', o.id,
            'total_amount', o.total_amount,
            'status', o.status,
            'created_at', o.created_at
          ) AS order_info,

          pc.code AS coupon_code

       FROM promotion_usage pu
       JOIN users u  ON pu.user_id  = u.id
       JOIN orders o ON pu.order_id = o.id
       LEFT JOIN promotion_coupons pc ON pu.coupon_id = pc.id
       WHERE pu.promotion_id = $1
       ORDER BY pu.created_at DESC`,
      [id]
    ),
  ]);

  return {
    promotion: promoRes.rows[0],
    summary:   summary.rows[0],
    usage:     breakdown.rows,
  };
};









exports.addCoupons = async (promotionId, coupons = []) => {
  if (!Array.isArray(coupons) || coupons.length === 0) {
    const err = new Error('coupons must be a non-empty array');
    err.status = 400;
    throw err;
  }

  
  const promoRes = await db.query(
    `SELECT id FROM promotions WHERE id = $1`,
    [promotionId]
  );

  if (!promoRes.rows[0]) {
    const err = new Error('Promotion not found');
    err.status = 404;
    throw err;
  }

  const inserted = [];

  try {
    for (const coupon of coupons) {
      if (!coupon.code?.trim()) {
        const err = new Error('Each coupon must have a non-empty code');
        err.status = 400;
        throw err;
      }

      const res = await db.query(
        `INSERT INTO promotion_coupons
           (promotion_id, code, usage_limit, expires_at, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [
          promotionId,
          coupon.code.trim().toUpperCase(),
          coupon.usage_limit || null,
          coupon.expires_at  || null,
        ]
      );

      inserted.push(res.rows[0]);
    }
  } catch (err) {
    if (err.code === '23505') {
      const e = new Error('One or more coupon codes already exist');
      e.status = 400;
      throw e;
    }
    throw err;
  }

  return inserted;
};





exports.toggleCoupon = async (promotionId, couponId) => {
  const result = await db.query(
    `UPDATE promotion_coupons
     SET is_active = NOT is_active
     WHERE id = $1 AND promotion_id = $2
     RETURNING *`,
    [couponId, promotionId]
  );

  if (!result.rows[0]) {
    const err = new Error('Coupon not found on this promotion');
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};





exports.deleteCoupon = async (promotionId, couponId) => {
  
  const usageRes = await db.query(
    `SELECT COUNT(*)::INTEGER AS count
     FROM promotion_usage
     WHERE coupon_id = $1`,
    [couponId]
  );

  if (usageRes.rows[0].count > 0) {
    const err = new Error(
      `Cannot delete a coupon that has been used ${usageRes.rows[0].count} time(s). ` +
      `Deactivate it instead.`
    );
    err.status = 409;
    throw err;
  }

  const result = await db.query(
    `DELETE FROM promotion_coupons
     WHERE id = $1 AND promotion_id = $2
     RETURNING *`,
    [couponId, promotionId]
  );

  if (!result.rows[0]) {
    const err = new Error('Coupon not found on this promotion');
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};
