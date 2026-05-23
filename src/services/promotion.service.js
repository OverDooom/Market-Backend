const db = require('../config/db');


// =========================================
// GET AUTOMATIC PROMOTIONS
// =========================================

exports.getAutomaticPromotions = async (client = db) => {

  const result = await client.query(`
    SELECT *
    FROM promotions
    WHERE is_active = true
    AND is_automatic = true
    AND (
      start_date IS NULL
      OR start_date <= NOW()
    )
    AND (
      end_date IS NULL
      OR end_date >= NOW()
    )
  `);

  return result.rows;
};


// =========================================
// VALIDATE COUPON
// =========================================

exports.validateCoupon = async (code, client = db) => {

  const result = await client.query(`
    SELECT
      pc.id AS coupon_id,
      pc.code,
      pc.expires_at,
      pc.usage_limit AS coupon_usage_limit,

      p.*

    FROM promotion_coupons pc

    JOIN promotions p
      ON pc.promotion_id = p.id

    WHERE LOWER(pc.code) = LOWER($1)
    AND pc.is_active = true
    AND p.is_active = true
  `, [code]);

  const coupon = result.rows[0];

  if (!coupon) {
    const err = new Error('Invalid coupon code');
    err.status = 404;
    throw err;
  }
  
// coupon usage limit
  if (coupon.coupon_usage_limit) {
    const used = await client.query(
      `SELECT COUNT(*)::INTEGER AS count
      FROM promotion_usage WHERE coupon_id = $1`,
      [coupon.coupon_id]
    );
    if (used.rows[0].count >= coupon.coupon_usage_limit) {
      const err = new Error('Coupon usage limit reached');
      err.status = 400; throw err;
    }
  }

  // coupon expiry
  if (
    coupon.expires_at &&
    new Date(coupon.expires_at) < new Date()
  ) {
    const err = new Error('Coupon expired');
    err.status = 400;
    throw err;
  }

  // promotion dates
  if (
    coupon.start_date &&
    new Date(coupon.start_date) > new Date()
  ) {
    const err = new Error('Promotion not started');
    err.status = 400;
    throw err;
  }

  if (
    coupon.end_date &&
    new Date(coupon.end_date) < new Date()
  ) {
    const err = new Error('Promotion expired');
    err.status = 400;
    throw err;
  }

  return coupon;
};

// =========================================
// GET PROMOTION PRODUCTS
// =========================================

exports.getPromotionProducts = async (promotionId, client = db) => {

  const result = await client.query(
    `
    SELECT product_id
    FROM promotion_products
    WHERE promotion_id = $1
    `,
    [promotionId]
  );

  return result.rows.map(
    row => row.product_id
  );
};

// =========================================
// GET PROMOTION CATEGORIES
// =========================================

exports.getPromotionCategories =
async (promotionId, client = db) => {

  const result = await client.query(
    `
    SELECT category_id
    FROM promotion_categories
    WHERE promotion_id = $1
    `,
    [promotionId]
  );

  return result.rows.map(
    row => row.category_id
  );
};

// =========================================
// VALIDATE PROMOTION CONDITIONS
// =========================================

exports.validatePromotionConditions =
async ({
  promotion,
  userId,
  subtotal
}, client = db) => {

  // =====================================
  // MIN CART TOTAL
  // =====================================

  if (
    promotion.min_cart_total &&
    subtotal < Number(
      promotion.min_cart_total
    )
  ) {
    return false;
  }

  // =====================================
  // FIRST ORDER ONLY
  // =====================================

  if (promotion.first_order_only) {

    const existingOrders =
      await client.query(
        `
        SELECT id
        FROM orders
        WHERE user_id = $1
        LIMIT 1
        `,
        [userId]
      );

    if (
      existingOrders.rows.length > 0
    ) {
      return false;
    }
  }

  // =====================================
  // GLOBAL USAGE LIMIT
  // =====================================

  if (promotion.usage_limit) {

    const usage =
      await client.query(
        `
        SELECT COUNT(*)::INTEGER AS count
        FROM promotion_usage
        WHERE promotion_id = $1
        `,
        [promotion.id]
      );

    if (
      usage.rows[0].count >=
      promotion.usage_limit
    ) {
      return false;
    }
  }

  // =====================================
  // USER USAGE LIMIT
  // =====================================

  if (promotion.usage_per_user) {

    const usage =
      await client.query(
        `
        SELECT COUNT(*)::INTEGER AS count
        FROM promotion_usage
        WHERE promotion_id = $1
        AND user_id = $2
        `,
        [
          promotion.id,
          userId
        ]
      );

    if (
      usage.rows[0].count >=
      promotion.usage_per_user
    ) {
      return false;
    }
  }

  // =====================================
  // USER TARGETING
  // =====================================

  const targetedUsers =
    await client.query(
      `
      SELECT user_id
      FROM promotion_users
      WHERE promotion_id = $1
      `,
      [promotion.id]
    );

  // if promotion has user targeting
  if (
    targetedUsers.rows.length > 0
  ) {

    const allowed =
      targetedUsers.rows.some(
        row =>
          row.user_id === userId
      );

    if (!allowed) {
      return false;
    }
  }

  return true;
};

// =========================================
// GET ELIGIBLE ITEMS
// =========================================

exports.getEligibleItems =
async (
  promotion,
  items,
  client = db
) => {

  const productIds =
    await exports.getPromotionProducts(
      promotion.id,
      client
    );

  const categoryIds =
    await exports.getPromotionCategories(
      promotion.id,
      client
    );

  // no targeting => all items
  if (
    productIds.length === 0 &&
    categoryIds.length === 0
  ) {
    return items;
  }

  return items.filter(item => {

    const productMatch =
      productIds.includes(
        item.product_id
      );

    const categoryMatch =
      categoryIds.includes(
        item.category_id
      );

    return (
      productMatch ||
      categoryMatch
    );
  });
};

// =========================================
// RECORD PROMOTION USAGE
// =========================================

exports.recordPromotionUsage =
async ({
  client = db,
  promotions,
  userId,
  orderId
}) => {

  for (const promo of promotions) {

    await client.query(
      `
      INSERT INTO promotion_usage (
        promotion_id,
        coupon_id,
        user_id,
        order_id,
        discount_amount
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        promo.promotion_id,
        promo.coupon_id,
        userId,
        orderId,
        promo.amount
      ]
    );
  }
};