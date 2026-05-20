const db = require('../config/db');

// CHECKOUT
exports.checkout = async (userId, addressId) => {
  const client = await db.connect();

  try {

    await client.query('BEGIN');

    // 1. Get cart
    const cartRes = await client.query(
      `SELECT * FROM carts WHERE user_id = $1`,
      [userId]
    );

    const cart = cartRes.rows[0];

    if (!cart) {
      const err = new Error('Cart not found');
      err.status = 404;
      throw err;
    }

    // 2. Get cart items
    const itemsRes = await client.query(
      `SELECT
          ci.product_variant_id,
          ci.quantity,
          pv.price,
          pv.quantity AS stock
       FROM cart_items ci
       JOIN product_variants pv
         ON ci.product_variant_id = pv.id
       WHERE ci.cart_id = $1`,
      [cart.id]
    );

    const items = itemsRes.rows;

    if (items.length === 0) {
      const err = new Error('Cart is empty');
      err.status = 400;
      throw err;
    }

    // 3. Validate stock + calculate total
    let total = 0;

    for (const item of items) {

      if (item.quantity > item.stock) {
        const err = new Error(
          `Insufficient stock for variant ${item.product_variant_id}`
        );

        err.status = 400;
        throw err;
      }

      total += item.price * item.quantity;
    }

    // 4. Create order
    const orderRes = await client.query(
      `INSERT INTO orders
       (user_id, address_id, total_amount, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        userId,
        addressId,
        total,
        'pending'
      ]
    );

    const order = orderRes.rows[0];

    // 5. Create order items
    for (const item of items) {

      await client.query(
        `INSERT INTO order_items
         (
           order_id,
           product_variant_id,
           quantity,
           price_at_purchase
         )
         VALUES ($1, $2, $3, $4)`,
        [
          order.id,
          item.product_variant_id,
          item.quantity,
          item.price
        ]
      );

      // 6. Reduce stock
      await client.query(
        `UPDATE product_variants
         SET quantity = quantity - $1
         WHERE id = $2`,
        [
          item.quantity,
          item.product_variant_id
        ]
      );
    }

    // 7. Clear cart
    await client.query(
      `DELETE FROM cart_items WHERE cart_id = $1`,
      [cart.id]
    );

    await client.query('COMMIT');

    return order;

  } catch (err) {

    await client.query('ROLLBACK');
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