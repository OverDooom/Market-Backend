const db = require('../config/db');


const cartService =
require('./cart.service');

const pricingService =
require('./pricing.service');

const promotionService =
require('./promotion.service');


// =========================================
// CHECKOUT
// =========================================

exports.checkout =
async ({
  userId,
  addressId,
  couponCodes = []
}) => {

  const client =
    await db.connect();

  try {

    await client.query(
      'BEGIN'
    );

    // =====================================
    // LOAD CART WITH LOCK
    // =====================================

    const cart =
      await cartService
      .getCartForCheckout(
        userId,
        client
      );

    if (
      cart.items.length === 0
    ) {

      const err = new Error(
        'Cart is empty'
      );

      err.status = 400;

      throw err;
    }

    // =====================================
    // VALIDATE STOCK
    // =====================================

    for (const item of cart.items) {

      if (
        item.quantity >
        item.stock_quantity
      ) {

        const err = new Error(
          `Insufficient stock for ${item.product_name}`
        );

        err.status = 400;

        throw err;
      }
    }

    // =====================================
    // CALCULATE PRICING
    // =====================================

    const pricing =
      await pricingService
      .calculateCart({
        client,
        userId,
        items: cart.items,
        couponCodes
      });


    // =====================================
    // VALIDATE ADDRESS
    // =====================================
    const addrCheck = await client.query(
      `SELECT id FROM addresses WHERE id = $1 AND user_id = $2`,
      [addressId, userId]
    );
    if (!addrCheck.rows[0]) {
      const err = new Error('Invalid address');
      err.status = 400; throw err;
    }
    
    // =====================================
    // CREATE ORDER
    // =====================================

    const orderResult =
      await client.query(
        `
        INSERT INTO orders (
          user_id,
          address_id,
          subtotal,
          discount_total,
          total_amount,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          'pending'
        )
        RETURNING *
        `,
        [
          userId,
          addressId,

          pricing.subtotal,

          pricing.discount_total,

          pricing.total
        ]
      );

    const order =
      orderResult.rows[0];

    // =====================================
    // CREATE ORDER ITEMS
    // =====================================

    for (const item of cart.items) {

      await client.query(
        `
        INSERT INTO order_items (
          order_id,
          product_variant_id,
          quantity,
          price_at_purchase
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
          order.id,
          item.variant_id,
          item.quantity,
          item.price
        ]
      );
    }

    // =====================================
    // REDUCE STOCK
    // =====================================

    for (const item of cart.items) {

      await client.query(
        `
        UPDATE product_variants
        SET quantity =
          quantity - $1
        WHERE id = $2
        `,
        [
          item.quantity,
          item.variant_id
        ]
      );
    }

    // =====================================
    // RECORD PROMOTION USAGE
    // =====================================

    await promotionService
      .recordPromotionUsage({

        client,

        promotions:
          pricing.discounts,

        userId,

        orderId:
          order.id
      });

    // =====================================
    // CLEAR CART
    // =====================================

    await client.query(
      `
      DELETE FROM cart_items
      WHERE cart_id = $1
      `,
      [cart.id]
    );

    // =====================================
    // COMMIT
    // =====================================

    await client.query(
      'COMMIT'
    );

    return {

      order,

      pricing
    };

  } catch (err) {

    await client.query(
      'ROLLBACK'
    );

    throw err;

  } finally {

    client.release();
  }
};

// GET MY ORDERS
exports.getMyOrders = async (userId) => {

  const result = await db.query(
    `SELECT *
     FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
};

// GET SINGLE ORDER
exports.getOrderById = async (orderId, userId) => {

  const orderRes = await db.query(
    `SELECT *
     FROM orders
     WHERE id = $1
     AND user_id = $2`,
    [orderId, userId]
  );

  const order = orderRes.rows[0];

  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }

  const itemsRes = await db.query(
    `SELECT
        oi.id,
        oi.quantity,
        oi.price_at_purchase,

        pv.sku,

        p.name AS product_name

     FROM order_items oi

     JOIN product_variants pv
       ON oi.product_variant_id = pv.id

     JOIN products p
       ON pv.product_id = p.id

     WHERE oi.order_id = $1`,
    [orderId]
  );

  order.items = itemsRes.rows;

  return order;
};

// ADMIN UPDATE STATUS
exports.updateOrderStatus = async (orderId, status) => {

  const allowed = [
    'pending',
    'paid',
    'shipped',
    'delivered',
    'cancelled'
  ];

  if (!allowed.includes(status)) {
    const err = new Error('Invalid order status');
    err.status = 400;
    throw err;
  }

  const result = await db.query(
    `UPDATE orders
     SET status = $1
     WHERE id = $2
     RETURNING *`,
    [status, orderId]
  );

  if (!result.rows[0]) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};