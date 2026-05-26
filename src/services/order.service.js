const db              = require('../config/db');
const cartService     = require('./cart.service');
const pricingService  = require('./pricing.service');
const promotionService = require('./promotion.service');
const notificationService = require('./notification.service');

// =========================================
// STATE MACHINE
// =========================================
// Maps every status to the statuses it is
// allowed to transition into.
// Terminal states map to an empty array.
// =========================================

const TRANSITIONS = {
  pending:   ['paid', 'cancelled'],
  paid:      ['shipped', 'cancelled'],
  shipped:   ['delivered'],           // no cancellation once shipped
  delivered: [],
  cancelled: [],
};

// Statuses from which stock should be
// restored when an order is cancelled.
const RESTORE_STOCK_FROM = new Set(['pending', 'paid']);

// User-facing notification copy per transition.
const NOTIFICATION_COPY = {
  paid: {
    title:   'Order Confirmed',
    message: (id) => `Your order #${id} has been confirmed and payment received.`,
  },
  shipped: {
    title:   'Order Shipped',
    message: (id) => `Great news! Your order #${id} is on its way.`,
  },
  delivered: {
    title:   'Order Delivered',
    message: (id) => `Your order #${id} has been delivered. Enjoy!`,
  },
  cancelled: {
    title:   'Order Cancelled',
    message: (id) => `Your order #${id} has been cancelled.`,
  },
};

// =========================================
// HELPERS
// =========================================

/**
 * Validate that `toStatus` is a legal next
 * step from `fromStatus`. Throws 400 if not.
 */
function assertValidTransition(fromStatus, toStatus) {
  const allowed = TRANSITIONS[fromStatus];

  if (allowed === undefined) {
    // fromStatus is not in our machine at all
    const err = new Error(`Unknown order status: '${fromStatus}'`);
    err.status = 500;
    throw err;
  }

  if (!allowed.includes(toStatus)) {
    const err = new Error(
      allowed.length === 0
        ? `Order is already in a terminal state '${fromStatus}' and cannot be updated.`
        : `Cannot move order from '${fromStatus}' to '${toStatus}'. ` +
          `Allowed transitions: ${allowed.join(', ')}.`
    );
    err.status = 400;
    throw err;
  }
}

/**
 * Record a transition in order_status_history.
 * Accepts an optional pg client for use inside
 * a transaction; falls back to the pool.
 */
async function recordHistory({
  client = db,
  orderId,
  fromStatus,
  toStatus,
  changedBy = null,
  notes     = null,
}) {
  await client.query(
    `INSERT INTO order_status_history
       (order_id, from_status, to_status, changed_by, notes)
     VALUES ($1, $2, $3, $4, $5)`,
    [orderId, fromStatus || null, toStatus, changedBy, notes]
  );
}

/**
 * Restore stock for every item in an order.
 * Called inside a transaction (client required).
 */
async function restoreStock(client, orderId) {
  await client.query(
    `UPDATE product_variants pv
     SET quantity = pv.quantity + oi.quantity
     FROM order_items oi
     WHERE oi.order_id   = $1
       AND oi.product_variant_id = pv.id`,
    [orderId]
  );
}

/**
 * Fire a notification to the order's owner.
 * Non-fatal — logs but does not crash on error.
 */
async function notifyOwner(order, toStatus) {
  const copy = NOTIFICATION_COPY[toStatus];
  if (!copy) return; // no copy defined → skip silently

  try {
    await notificationService.createNotification({
      title:       copy.title,
      message:     copy.message(order.id),
      type:        'order_status',
      referenceId: order.id,
      userIds:     [order.user_id],
    });
  } catch (notifErr) {
    // Never let a notification failure abort the main flow
    console.error('[notifyOwner] failed:', notifErr.message);
  }
}

// =========================================
// CHECKOUT
// =========================================

exports.checkout = async ({ userId, addressId, couponCodes = [] }) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Load cart with row-level lock
    const cart = await cartService.getCartForCheckout(userId, client);

    if (cart.items.length === 0) {
      const err = new Error('Cart is empty');
      err.status = 400;
      throw err;
    }

    // Validate stock
    for (const item of cart.items) {
      if (item.quantity > item.stock_quantity) {
        const err = new Error(
          `Insufficient stock for ${item.product_name}`
        );
        err.status = 400;
        throw err;
      }
    }

    // Calculate pricing
    const pricing = await pricingService.calculateCart({
      client,
      userId,
      items: cart.items,
      couponCodes,
    });

    // Validate address belongs to user
    const addrCheck = await client.query(
      `SELECT id FROM addresses WHERE id = $1 AND user_id = $2`,
      [addressId, userId]
    );
    if (!addrCheck.rows[0]) {
      const err = new Error('Invalid address');
      err.status = 400;
      throw err;
    }

    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders
         (user_id, address_id, subtotal, discount_total, total_amount, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [userId, addressId, pricing.subtotal, pricing.discount_total, pricing.total]
    );

    const order = orderResult.rows[0];

    // Create order items
    for (const item of cart.items) {
      await client.query(
        `INSERT INTO order_items
           (order_id, product_variant_id, quantity, price_at_purchase)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.variant_id, item.quantity, item.price]
      );
    }

    // Deduct stock
    for (const item of cart.items) {
      await client.query(
        `UPDATE product_variants
         SET quantity = quantity - $1
         WHERE id = $2`,
        [item.quantity, item.variant_id]
      );
    }

    // Record promotion usage
    await promotionService.recordPromotionUsage({
      client,
      promotions: pricing.discounts,
      userId,
      orderId: order.id,
    });

    // Record initial status in history
    await recordHistory({
      client,
      orderId:    order.id,
      fromStatus: null,
      toStatus:   'pending',
      changedBy:  userId,
      notes:      'Order placed',
    });

    // Clear cart
    await client.query(
      `DELETE FROM cart_items WHERE cart_id = $1`,
      [cart.id]
    );

    await client.query('COMMIT');

    return { order, pricing };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// =========================================
// ADMIN — UPDATE ORDER STATUS
// =========================================

exports.updateOrderStatus = async (orderId, toStatus, adminId, notes = null) => {
  // 1. Fetch current order
  const orderRes = await db.query(
    `SELECT * FROM orders WHERE id = $1`,
    [orderId]
  );

  const order = orderRes.rows[0];

  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }

  // 2. Validate transition
  assertValidTransition(order.status, toStatus);

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 3. Update status
    const updated = await client.query(
      `UPDATE orders
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [toStatus, orderId]
    );

    // 4. Restore stock if cancelling from a restoreable state
    if (
      toStatus === 'cancelled' &&
      RESTORE_STOCK_FROM.has(order.status)
    ) {
      await restoreStock(client, orderId);
    }

    // 5. Record in history
    await recordHistory({
      client,
      orderId,
      fromStatus: order.status,
      toStatus,
      changedBy:  adminId,
      notes,
    });

    await client.query('COMMIT');

    const updatedOrder = updated.rows[0];

    // 6. Notify customer (outside transaction — non-fatal)
    await notifyOwner(updatedOrder, toStatus);

    return updatedOrder;

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// =========================================
// USER — CANCEL OWN ORDER
// =========================================

exports.cancelOrder = async (orderId, userId) => {
  // 1. Fetch order and verify ownership
  const orderRes = await db.query(
    `SELECT * FROM orders WHERE id = $1 AND user_id = $2`,
    [orderId, userId]
  );

  const order = orderRes.rows[0];

  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }

  // 2. Users may only cancel pending orders
  if (order.status !== 'pending') {
    const err = new Error(
      `Only pending orders can be self-cancelled. ` +
      `Current status: '${order.status}'.`
    );
    err.status = 400;
    throw err;
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 3. Update status
    const updated = await client.query(
      `UPDATE orders
       SET status = 'cancelled'
       WHERE id = $1
       RETURNING *`,
      [orderId]
    );

    // 4. Restore stock (pending → cancelled always restores)
    await restoreStock(client, orderId);

    // 5. Record in history
    await recordHistory({
      client,
      orderId,
      fromStatus: 'pending',
      toStatus:   'cancelled',
      changedBy:  userId,
      notes:      'Cancelled by customer',
    });

    await client.query('COMMIT');

    const updatedOrder = updated.rows[0];

    // 6. Notify (confirmation to the customer themselves)
    await notifyOwner(updatedOrder, 'cancelled');

    return updatedOrder;

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// =========================================
// GET STATUS HISTORY FOR AN ORDER
// =========================================

exports.getOrderHistory = async (orderId, userId, isAdmin = false) => {
  // Non-admin: verify ownership first
  if (!isAdmin) {
    const orderRes = await db.query(
      `SELECT id FROM orders WHERE id = $1 AND user_id = $2`,
      [orderId, userId]
    );
    if (!orderRes.rows[0]) {
      const err = new Error('Order not found');
      err.status = 404;
      throw err;
    }
  }

  const result = await db.query(
    `SELECT
        osh.id,
        osh.from_status,
        osh.to_status,
        osh.notes,
        osh.created_at,

        json_build_object(
          'id',   u.id,
          'name', u.name,
          'role', r.name
        ) AS changed_by

     FROM order_status_history osh

     LEFT JOIN users u
       ON osh.changed_by = u.id

     LEFT JOIN roles r
       ON u.role_id = r.id

     WHERE osh.order_id = $1

     ORDER BY osh.created_at ASC`,
    [orderId]
  );

  return result.rows;
};

// =========================================
// GET MY ORDERS
// =========================================

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

// =========================================
// GET SINGLE ORDER
// =========================================

exports.getOrderById = async (orderId, userId) => {
  const orderRes = await db.query(
    `SELECT *
     FROM orders
     WHERE id = $1 AND user_id = $2`,
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
