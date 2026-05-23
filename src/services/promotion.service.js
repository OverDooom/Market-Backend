const db = require('../config/db');


// =========================================
// GET AUTOMATIC PROMOTIONS
// =========================================

exports.getAutomaticPromotions = async () => {

  const result = await db.query(`
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

exports.validateCoupon = async (code) => {

  const result = await db.query(`
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