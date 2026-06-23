const db = require('../config/db');





exports.getAllUsers = async ({ search, role, page = 1, limit = 20 } = {}) => {
  const values     = [];
  const conditions = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(
      `(u.name ILIKE $${values.length} OR u.email ILIKE $${values.length})`
    );
  }

  if (role) {
    values.push(role);
    conditions.push(`r.name = $${values.length}`);
  }

  const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  values.push(limit, offset);

  const result = await db.query(
    `SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        u.created_at,
        r.name AS role,

        COUNT(DISTINCT o.id)::INTEGER  AS order_count,
        COUNT(DISTINCT rv.id)::INTEGER AS review_count

     FROM users u
     LEFT JOIN roles r  ON u.role_id = r.id
     LEFT JOIN orders o ON o.user_id = u.id
     LEFT JOIN reviews rv ON rv.user_id = u.id
     ${where}
     GROUP BY u.id, r.name
     ORDER BY u.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return result.rows;
};

exports.getUser = async (id) => {
  const result = await db.query(
    `SELECT u.id, u.name, u.email, u.phone, u.created_at, r.name AS role
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`,
    [id]
  );

  if (!result.rows[0]) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};

exports.updateUser = async (id, data) => {
  const existing = await db.query(
    `SELECT u.*, r.name AS role_name
     FROM users u LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`,
    [id]
  );

  if (!existing.rows[0]) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const user = existing.rows[0];

  
  let newRoleId = user.role_id;
  if (data.role && data.role !== user.role_name) {
    const roleRes = await db.query(
      `SELECT id FROM roles WHERE name = $1`,
      [data.role]
    );
    if (!roleRes.rows[0]) {
      const err = new Error(`Role '${data.role}' does not exist`);
      err.status = 400;
      throw err;
    }
    newRoleId = roleRes.rows[0].id;
  }

  
  if (data.email && data.email !== user.email) {
    const dup = await db.query(
      `SELECT id FROM users WHERE email = $1 AND id != $2`,
      [data.email, id]
    );
    if (dup.rows[0]) {
      const err = new Error('Email already in use');
      err.status = 400;
      throw err;
    }
  }

  const result = await db.query(
    `UPDATE users
     SET name    = $1,
         email   = $2,
         phone   = $3,
         role_id = $4
     WHERE id = $5
     RETURNING id, name, email, phone, role_id`,
    [
      data.name  ?? user.name,
      data.email ?? user.email,
      data.phone ?? user.phone,
      newRoleId,
      id,
    ]
  );

  return result.rows[0];
};

exports.deleteUser = async (id) => {
  try {
    const result = await db.query(
      `DELETE FROM users WHERE id = $1 RETURNING *`,
      [id]
    );

    if (!result.rows[0]) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    return result.rows[0];

  } catch (err) {
    if (err.code === '23503') {
      const e = new Error(
        'Cannot delete user: they have existing orders, reviews, or addresses. Deactivate them instead.'
      );
      e.status = 409;
      throw e;
    }
    throw err;
  }
};

exports.getUserOrders = async (userId) => {
  const user = await db.query(`SELECT id FROM users WHERE id = $1`, [userId]);
  if (!user.rows[0]) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const result = await db.query(
    `SELECT o.*,
            COUNT(oi.id)::INTEGER AS item_count
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = $1
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    [userId]
  );

  return result.rows;
};

exports.getUserReviews = async (userId) => {
  const user = await db.query(`SELECT id FROM users WHERE id = $1`, [userId]);
  if (!user.rows[0]) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const result = await db.query(
    `SELECT
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        json_build_object('id', p.id, 'name', p.name) AS product
     FROM reviews r
     JOIN products p ON r.product_id = p.id
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC`,
    [userId]
  );

  return result.rows;
};





exports.getAllOrders = async ({
  status,
  userId,
  page  = 1,
  limit = 20,
} = {}) => {
  const values     = [];
  const conditions = [];

  if (status) {
    values.push(status);
    conditions.push(`o.status = $${values.length}`);
  }

  if (userId) {
    values.push(userId);
    conditions.push(`o.user_id = $${values.length}`);
  }

  const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  values.push(limit, offset);

  const result = await db.query(
    `SELECT
        o.*,
        json_build_object('id', u.id, 'name', u.name, 'email', u.email) AS customer,
        COUNT(oi.id)::INTEGER AS item_count
     FROM orders o
     JOIN users u ON o.user_id = u.id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     ${where}
     GROUP BY o.id, u.id
     ORDER BY o.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return result.rows;
};

exports.getOrderByIdAdmin = async (orderId) => {
  const orderRes = await db.query(
    `SELECT
        o.*,
        json_build_object('id', u.id, 'name', u.name, 'email', u.email) AS customer,
        json_build_object(
          'id', a.id, 'city', a.city, 'street', a.street,
          'building', a.building, 'area', a."Area"
        ) AS address
     FROM orders o
     JOIN users u ON o.user_id = u.id
     LEFT JOIN addresses a ON o.address_id = a.id
     WHERE o.id = $1`,
    [orderId]
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
        p.name AS product_name,
        p.id   AS product_id
     FROM order_items oi
     JOIN product_variants pv ON oi.product_variant_id = pv.id
     JOIN products p          ON pv.product_id = p.id
     WHERE oi.order_id = $1`,
    [orderId]
  );

  order.items = itemsRes.rows;
  return order;
};





exports.getAllReviews = async ({
  productId,
  rating,
  page  = 1,
  limit = 20,
} = {}) => {
  const values     = [];
  const conditions = [];

  if (productId) {
    values.push(productId);
    conditions.push(`r.product_id = $${values.length}`);
  }

  if (rating) {
    values.push(rating);
    conditions.push(`r.rating = $${values.length}`);
  }

  const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  values.push(limit, offset);

  const result = await db.query(
    `SELECT
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        json_build_object('id', u.id, 'name', u.name, 'email', u.email) AS user,
        json_build_object('id', p.id, 'name', p.name)                   AS product
     FROM reviews r
     JOIN users u    ON r.user_id    = u.id
     JOIN products p ON r.product_id = p.id
     ${where}
     ORDER BY r.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return result.rows;
};

exports.deleteReview = async (reviewId) => {
  const result = await db.query(
    `DELETE FROM reviews WHERE id = $1 RETURNING *`,
    [reviewId]
  );

  if (!result.rows[0]) {
    const err = new Error('Review not found');
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};

// =========================================
// NOTIFICATIONS
// =========================================

exports.getAllNotifications = async ({ page = 1, limit = 30 } = {}) => {
  const offset = (page - 1) * limit;

  const result = await db.query(
    `SELECT
        n.*,
        COUNT(un.id)::INTEGER                                  AS recipient_count,
        COUNT(un.id) FILTER (WHERE un.is_read)::INTEGER        AS read_count
     FROM notifications n
     LEFT JOIN user_notifications un ON un.notification_id = n.id
     GROUP BY n.id
     ORDER BY n.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return result.rows;
};






exports.sendNotification = async ({
  title,
  message,
  type        = 'admin',
  referenceId = null,
  userIds     = [],
  broadcastAll = false,
}) => {
  if (!title || !message) {
    const err = new Error('title and message are required');
    err.status = 400;
    throw err;
  }

  let targetIds = userIds;

  if (broadcastAll) {
    const all = await db.query(`SELECT id FROM users`);
    targetIds = all.rows.map(r => r.id);
  }

  if (targetIds.length === 0) {
    const err = new Error(
      'Provide at least one user_id or set broadcast_all to true'
    );
    err.status = 400;
    throw err;
  }

  
  const notificationService = require('./notification.service');

  return notificationService.createNotification({
    title,
    message,
    type,
    referenceId,
    userIds: targetIds,
  });
};

exports.deleteNotification = async (notificationId) => {
  
  const result = await db.query(
    `DELETE FROM notifications WHERE id = $1 RETURNING *`,
    [notificationId]
  );

  if (!result.rows[0]) {
    const err = new Error('Notification not found');
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};








exports.getWishlistStats = async ({ limit = 20 } = {}) => {
  const result = await db.query(
    `SELECT
        p.id             AS product_id,
        p.name           AS product_name,
        p.brand,
        json_build_object('id', c.id, 'name', c.name) AS category,
        COUNT(wi.id)::INTEGER AS wishlist_count
     FROM wishlist_items wi
     JOIN products p   ON wi.product_id  = p.id
     LEFT JOIN categories c ON p.category_id = c.id
     GROUP BY p.id, c.id
     ORDER BY wishlist_count DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
};




exports.getUserWishlist = async (userId) => {
  const user = await db.query(`SELECT id FROM users WHERE id = $1`, [userId]);
  if (!user.rows[0]) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const result = await db.query(
    `SELECT
        wi.id,
        wi.created_at AS added_at,
        p.id          AS product_id,
        p.name        AS product_name,
        p.brand,
        json_build_object('id', c.id, 'name', c.name) AS category,
        COALESCE(MIN(v.price), 0) AS min_price,
        COALESCE(MAX(v.price), 0) AS max_price,
        CASE WHEN COALESCE(SUM(v.quantity), 0) > 0 THEN true ELSE false END AS in_stock
     FROM wishlist_items wi
     JOIN products p         ON wi.product_id  = p.id
     LEFT JOIN categories c  ON p.category_id  = c.id
     LEFT JOIN product_variants v ON p.id = v.product_id
     WHERE wi.user_id = $1
     GROUP BY wi.id, p.id, c.id
     ORDER BY wi.created_at DESC`,
    [userId]
  );

  return result.rows;
};





exports.getDashboardStats = async () => {
  const [
    usersRes,
    ordersRes,
    revenueRes,
    ordersByStatusRes,
    topProductsRes,
    recentOrdersRes,
    lowStockRes,
  ] = await Promise.all([

    
    db.query(`SELECT COUNT(*)::INTEGER AS total FROM users`),

    
    db.query(`SELECT COUNT(*)::INTEGER AS total FROM orders`),

    
    db.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total
       FROM orders
       WHERE status = 'delivered'`
    ),

    
    db.query(
      `SELECT status, COUNT(*)::INTEGER AS count
       FROM orders
       GROUP BY status`
    ),

    
    db.query(
      `SELECT
          p.id,
          p.name,
          SUM(oi.quantity)::INTEGER AS units_sold,
          SUM(oi.quantity * oi.price_at_purchase) AS revenue
       FROM order_items oi
       JOIN product_variants pv ON oi.product_variant_id = pv.id
       JOIN products p          ON pv.product_id = p.id
       JOIN orders o            ON oi.order_id   = o.id
       WHERE o.status != 'cancelled'
       GROUP BY p.id
       ORDER BY units_sold DESC
       LIMIT 5`
    ),

    
    db.query(
      `SELECT
          o.id,
          o.status,
          o.total_amount,
          o.created_at,
          json_build_object('id', u.id, 'name', u.name) AS customer
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC
       LIMIT 5`
    ),

    
    db.query(
      `SELECT
          pv.id,
          pv.sku,
          pv.quantity,
          p.name AS product_name
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       WHERE pv.quantity <= 5
       ORDER BY pv.quantity ASC
       LIMIT 10`
    ),
  ]);

  return {
    users: {
      total: usersRes.rows[0].total,
    },
    orders: {
      total:     ordersRes.rows[0].total,
      by_status: ordersRes.rows[0].total === 0
        ? []
        : ordersByStatusRes.rows,
    },
    revenue: {
      total_delivered: Number(revenueRes.rows[0].total),
    },
    top_products:   topProductsRes.rows,
    recent_orders:  recentOrdersRes.rows,
    low_stock:      lowStockRes.rows,
  };
};
