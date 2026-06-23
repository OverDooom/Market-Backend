const db = require('../config/db');





const VALID_PERIODS = ['daily', 'weekly', 'monthly', 'yearly'];

function getPeriodTrunc(period) {
  const map = {
    daily:   'day',
    weekly:  'week',
    monthly: 'month',
    yearly:  'year',
  };
  return map[period] || 'month';
}

function assertValidPeriod(period) {
  if (!VALID_PERIODS.includes(period)) {
    const err = new Error(
      `Invalid period '${period}'. Must be one of: ${VALID_PERIODS.join(', ')}`
    );
    err.status = 400;
    throw err;
  }
}





exports.getOverview = async () => {
  const [
    countsRes,
    revenueRes,
    todayRes,
    stockRes,
  ] = await Promise.all([

    
    db.query(`
      SELECT
        (SELECT COUNT(*)::INTEGER FROM users)                        AS total_users,
        (SELECT COUNT(*)::INTEGER FROM products WHERE deleted_at IS NULL) AS total_products,
        (SELECT COUNT(*)::INTEGER FROM product_variants)            AS total_variants,
        (SELECT COUNT(*)::INTEGER FROM categories)                  AS total_categories,
        (SELECT COUNT(*)::INTEGER FROM orders)                      AS total_orders,
        (SELECT COALESCE(SUM(total_amount), 0)
           FROM orders WHERE status = 'delivered')                  AS total_revenue,
        (SELECT COUNT(*)::INTEGER FROM orders WHERE status = 'pending')   AS pending_orders,
        (SELECT COUNT(*)::INTEGER FROM orders WHERE status = 'delivered') AS delivered_orders,
        (SELECT COUNT(*)::INTEGER FROM orders WHERE status = 'cancelled') AS cancelled_orders
    `),

    
    db.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS total_gross_revenue
      FROM orders
      WHERE status != 'cancelled'
    `),

    
    db.query(`
      SELECT
        COUNT(*)::INTEGER                        AS today_orders,
        COALESCE(SUM(total_amount), 0)           AS today_revenue
      FROM orders
      WHERE created_at >= CURRENT_DATE
        AND status != 'cancelled'
    `),

    
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE quantity > 0 AND quantity <= 5)::INTEGER AS low_stock_count,
        COUNT(*) FILTER (WHERE quantity = 0)::INTEGER                   AS out_of_stock_count
      FROM product_variants
    `),
  ]);

  const counts  = countsRes.rows[0];
  const today   = todayRes.rows[0];
  const stock   = stockRes.rows[0];

  return {
    users: {
      total: counts.total_users,
    },
    catalog: {
      total_products:   counts.total_products,
      total_variants:   counts.total_variants,
      total_categories: counts.total_categories,
    },
    orders: {
      total:     counts.total_orders,
      pending:   counts.pending_orders,
      delivered: counts.delivered_orders,
      cancelled: counts.cancelled_orders,
    },
    revenue: {
      total_delivered:    Number(counts.total_revenue),
      total_gross:        Number(revenueRes.rows[0].total_gross_revenue),
    },
    today: {
      orders:  today.today_orders,
      revenue: Number(today.today_revenue),
    },
    inventory: {
      low_stock:    stock.low_stock_count,
      out_of_stock: stock.out_of_stock_count,
    },
  };
};





exports.getRevenue = async ({ period = 'monthly' } = {}) => {
  assertValidPeriod(period);
  const trunc = getPeriodTrunc(period);

  const result = await db.query(`
    SELECT
      DATE_TRUNC($1, created_at)         AS period,
      COUNT(*)::INTEGER                  AS order_count,
      COALESCE(SUM(total_amount),   0)   AS gross_revenue,
      COALESCE(SUM(discount_total), 0)   AS total_discounts,
      COALESCE(SUM(subtotal),       0)   AS subtotal,
      ROUND(AVG(total_amount), 2)        AS avg_order_value
    FROM orders
    WHERE status != 'cancelled'
    GROUP BY DATE_TRUNC($1, created_at)
    ORDER BY period DESC
    LIMIT 24
  `, [trunc]);

  return {
    period,
    data: result.rows.map(r => ({
      period:          r.period,
      order_count:     r.order_count,
      gross_revenue:   Number(r.gross_revenue),
      total_discounts: Number(r.total_discounts),
      subtotal:        Number(r.subtotal),
      avg_order_value: Number(r.avg_order_value),
    })),
  };
};





exports.getOrderAnalytics = async ({ period = 'monthly' } = {}) => {
  assertValidPeriod(period);
  const trunc = getPeriodTrunc(period);

  const [statusRes, volumeRes, summaryRes] = await Promise.all([

    
    db.query(`
      SELECT
        status,
        COUNT(*)::INTEGER                AS count,
        COALESCE(SUM(total_amount), 0)   AS total_value
      FROM orders
      GROUP BY status
      ORDER BY count DESC
    `),

    
    db.query(`
      SELECT
        DATE_TRUNC($1, created_at)  AS period,
        COUNT(*)::INTEGER           AS order_count
      FROM orders
      GROUP BY DATE_TRUNC($1, created_at)
      ORDER BY period DESC
      LIMIT 24
    `, [trunc]),

    
    db.query(`
      SELECT
        ROUND(AVG(total_amount), 2)       AS avg_order_value,
        COALESCE(SUM(oi.quantity), 0)     AS total_items_sold,
        COUNT(DISTINCT o.id)::INTEGER     AS total_orders
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status != 'cancelled'
    `),
  ]);

  const summary = summaryRes.rows[0];

  return {
    by_status: statusRes.rows.map(r => ({
      status:      r.status,
      count:       r.count,
      total_value: Number(r.total_value),
    })),
    volume_over_time: volumeRes.rows.map(r => ({
      period:      r.period,
      order_count: r.order_count,
    })),
    summary: {
      total_orders:     summary.total_orders,
      avg_order_value:  Number(summary.avg_order_value),
      total_items_sold: Number(summary.total_items_sold),
    },
  };
};





exports.getTopProducts = async ({ limit = 10 } = {}) => {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

  const result = await db.query(`
    SELECT
      p.id                                          AS product_id,
      p.name                                        AS product_name,
      p.brand,
      json_build_object('id', c.id, 'name', c.name) AS category,
      SUM(oi.quantity)::INTEGER                     AS units_sold,
      COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0) AS revenue,
      ROUND(AVG(r.rating), 1)                       AS avg_rating,
      COUNT(DISTINCT r.id)::INTEGER                 AS review_count,
      COUNT(DISTINCT o.id)::INTEGER                 AS order_count
    FROM order_items oi
    JOIN product_variants pv ON oi.product_variant_id = pv.id
    JOIN products p          ON pv.product_id         = p.id
    JOIN orders o            ON oi.order_id            = o.id
    LEFT JOIN categories c   ON p.category_id          = c.id
    LEFT JOIN reviews r      ON r.product_id            = p.id
    WHERE o.status != 'cancelled'
      AND p.deleted_at IS NULL
    GROUP BY p.id, c.id
    ORDER BY units_sold DESC
    LIMIT $1
  `, [safeLimit]);

  return result.rows.map(r => ({
    product_id:   r.product_id,
    product_name: r.product_name,
    brand:        r.brand,
    category:     r.category,
    units_sold:   r.units_sold,
    revenue:      Number(r.revenue),
    avg_rating:   r.avg_rating ? Number(r.avg_rating) : null,
    review_count: r.review_count,
    order_count:  r.order_count,
  }));
};





exports.getTopCategories = async ({ limit = 10 } = {}) => {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

  const result = await db.query(`
    SELECT
      c.id                                              AS category_id,
      c.name                                            AS category_name,
      json_build_object('id', pc.id, 'name', pc.name)  AS parent_category,
      COUNT(DISTINCT p.id)::INTEGER                     AS product_count,
      SUM(oi.quantity)::INTEGER                         AS units_sold,
      COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0) AS revenue,
      COUNT(DISTINCT o.id)::INTEGER                     AS order_count
    FROM categories c
    LEFT JOIN categories pc   ON c.parent_id            = pc.id
    JOIN products p           ON p.category_id          = c.id
    JOIN product_variants pv  ON pv.product_id          = p.id
    JOIN order_items oi       ON oi.product_variant_id  = pv.id
    JOIN orders o             ON oi.order_id             = o.id
    WHERE o.status != 'cancelled'
      AND p.deleted_at IS NULL
    GROUP BY c.id, pc.id
    ORDER BY revenue DESC
    LIMIT $1
  `, [safeLimit]);

  return result.rows.map(r => ({
    category_id:     r.category_id,
    category_name:   r.category_name,
    parent_category: r.parent_category?.id ? r.parent_category : null,
    product_count:   r.product_count,
    units_sold:      r.units_sold,
    revenue:         Number(r.revenue),
    order_count:     r.order_count,
  }));
};





exports.getUserAnalytics = async ({ limit = 10 } = {}) => {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

  const [summaryRes, growthRes, topCustomersRes, activityRes] = await Promise.all([

    
    db.query(`
      SELECT
        COUNT(*)::INTEGER AS total_users,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '30 days'
        )::INTEGER AS new_users_30d,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '7 days'
        )::INTEGER AS new_users_7d
      FROM users
    `),

    
    db.query(`
      SELECT
        DATE_TRUNC('month', created_at) AS month,
        COUNT(*)::INTEGER               AS new_users
      FROM users
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
    `),

    
    db.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        COUNT(DISTINCT o.id)::INTEGER        AS order_count,
        COALESCE(SUM(o.total_amount), 0)     AS total_spent,
        MAX(o.created_at)                    AS last_order_at
      FROM users u
      JOIN orders o ON o.user_id = u.id
      WHERE o.status != 'cancelled'
      GROUP BY u.id
      ORDER BY total_spent DESC
      LIMIT $1
    `, [safeLimit]),

    
    db.query(`
      SELECT
        COUNT(DISTINCT u.id) FILTER (
          WHERE o.created_at >= NOW() - INTERVAL '90 days'
            AND o.status != 'cancelled'
        )::INTEGER AS active_customers,
        COUNT(DISTINCT u.id) FILTER (
          WHERE o.id IS NULL
            OR o.created_at < NOW() - INTERVAL '90 days'
        )::INTEGER AS inactive_customers
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id
    `),
  ]);

  const summary  = summaryRes.rows[0];
  const activity = activityRes.rows[0];

  return {
    summary: {
      total_users:    summary.total_users,
      new_users_30d:  summary.new_users_30d,
      new_users_7d:   summary.new_users_7d,
      active_customers:   activity.active_customers,
      inactive_customers: activity.inactive_customers,
    },
    growth_by_month: growthRes.rows,
    top_customers: topCustomersRes.rows.map(r => ({
      id:           r.id,
      name:         r.name,
      email:        r.email,
      order_count:  r.order_count,
      total_spent:  Number(r.total_spent),
      last_order_at: r.last_order_at,
    })),
  };
};





exports.getPromotionAnalytics = async () => {
  const [summaryRes, byPromotionRes, couponRes] = await Promise.all([

    
    db.query(`
      SELECT
        COUNT(DISTINCT pu.promotion_id)::INTEGER  AS promotions_used,
        COUNT(*)::INTEGER                         AS total_usage_events,
        COALESCE(SUM(pu.discount_amount), 0)      AS total_discount_granted,
        COALESCE(SUM(o.total_amount), 0)          AS revenue_on_discounted_orders,
        ROUND(AVG(pu.discount_amount), 2)         AS avg_discount_per_use
      FROM promotion_usage pu
      JOIN orders o ON pu.order_id = o.id
      WHERE o.status != 'cancelled'
    `),

    
    db.query(`
      SELECT
        p.id                                          AS promotion_id,
        p.name                                        AS promotion_name,
        p.type,
        p.value,
        p.is_active,
        COUNT(pu.id)::INTEGER                         AS usage_count,
        COUNT(DISTINCT pu.user_id)::INTEGER           AS unique_users,
        COALESCE(SUM(pu.discount_amount), 0)          AS total_discount_granted,
        COALESCE(SUM(o.total_amount), 0)              AS influenced_revenue,
        ROUND(AVG(pu.discount_amount), 2)             AS avg_discount
      FROM promotions p
      LEFT JOIN promotion_usage pu ON pu.promotion_id = p.id
      LEFT JOIN orders o           ON pu.order_id     = o.id
        AND o.status != 'cancelled'
      WHERE p.deleted_at IS NULL
      GROUP BY p.id
      ORDER BY total_discount_granted DESC
    `),

    
    db.query(`
      SELECT
        pc.id                                          AS coupon_id,
        pc.code,
        pc.is_active,
        pc.usage_limit,
        COUNT(pu.id)::INTEGER                          AS times_used,
        COALESCE(SUM(pu.discount_amount), 0)           AS total_discount
      FROM promotion_coupons pc
      LEFT JOIN promotion_usage pu ON pu.coupon_id = pc.id
      GROUP BY pc.id
      ORDER BY times_used DESC
      LIMIT 20
    `),
  ]);

  const summary = summaryRes.rows[0];

  return {
    summary: {
      promotions_used:             summary.promotions_used,
      total_usage_events:          summary.total_usage_events,
      total_discount_granted:      Number(summary.total_discount_granted),
      revenue_on_discounted_orders: Number(summary.revenue_on_discounted_orders),
      avg_discount_per_use:        Number(summary.avg_discount_per_use),
    },
    by_promotion: byPromotionRes.rows.map(r => ({
      promotion_id:          r.promotion_id,
      promotion_name:        r.promotion_name,
      type:                  r.type,
      value:                 Number(r.value),
      is_active:             r.is_active,
      usage_count:           r.usage_count,
      unique_users:          r.unique_users,
      total_discount_granted: Number(r.total_discount_granted),
      influenced_revenue:    Number(r.influenced_revenue),
      avg_discount:          Number(r.avg_discount),
    })),
    top_coupons: couponRes.rows.map(r => ({
      coupon_id:      r.coupon_id,
      code:           r.code,
      is_active:      r.is_active,
      usage_limit:    r.usage_limit,
      times_used:     r.times_used,
      total_discount: Number(r.total_discount),
    })),
  };
};





exports.getInventoryAnalytics = async ({ limit = 20 } = {}) => {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

  const [lowStockRes, outOfStockRes, mostRestockedRes, mostAdjustedRes] = await Promise.all([

    
    db.query(`
      SELECT
        pv.id          AS variant_id,
        pv.sku,
        pv.quantity,
        pv.price,
        p.id           AS product_id,
        p.name         AS product_name,
        p.brand
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.quantity > 0
        AND pv.quantity <= 5
        AND p.deleted_at IS NULL
      ORDER BY pv.quantity ASC
      LIMIT $1
    `, [safeLimit]),

    
    db.query(`
      SELECT
        pv.id          AS variant_id,
        pv.sku,
        pv.quantity,
        pv.price,
        p.id           AS product_id,
        p.name         AS product_name,
        p.brand
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.quantity = 0
        AND p.deleted_at IS NULL
      ORDER BY p.name ASC
      LIMIT $1
    `, [safeLimit]),

    
    db.query(`
      SELECT
        p.id           AS product_id,
        p.name         AS product_name,
        SUM(it.change)::INTEGER          AS total_units_restocked,
        COUNT(it.id)::INTEGER            AS restock_events
      FROM inventory_transactions it
      JOIN product_variants pv ON it.variant_id  = pv.id
      JOIN products p          ON pv.product_id  = p.id
      WHERE it.reason = 'restock'
        AND p.deleted_at IS NULL
      GROUP BY p.id
      ORDER BY total_units_restocked DESC
      LIMIT $1
    `, [safeLimit]),

    
    db.query(`
      SELECT
        p.id           AS product_id,
        p.name         AS product_name,
        COUNT(it.id)::INTEGER            AS adjustment_count,
        SUM(it.change)::INTEGER          AS net_change
      FROM inventory_transactions it
      JOIN product_variants pv ON it.variant_id = pv.id
      JOIN products p          ON pv.product_id = p.id
      WHERE it.reason = 'admin_edit'
        AND p.deleted_at IS NULL
      GROUP BY p.id
      ORDER BY adjustment_count DESC
      LIMIT $1
    `, [safeLimit]),
  ]);

  return {
    low_stock:      lowStockRes.rows,
    out_of_stock:   outOfStockRes.rows,
    most_restocked: mostRestockedRes.rows,
    most_adjusted:  mostAdjustedRes.rows,
  };
};





exports.getReviewAnalytics = async ({ limit = 10 } = {}) => {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

  const [summaryRes, topRatedRes, lowestRatedRes, mostReviewedRes] = await Promise.all([

    
    db.query(`
      SELECT
        COUNT(*)::INTEGER          AS total_reviews,
        ROUND(AVG(rating), 2)      AS avg_platform_rating,
        COUNT(*) FILTER (WHERE rating = 5)::INTEGER AS five_star,
        COUNT(*) FILTER (WHERE rating = 4)::INTEGER AS four_star,
        COUNT(*) FILTER (WHERE rating = 3)::INTEGER AS three_star,
        COUNT(*) FILTER (WHERE rating = 2)::INTEGER AS two_star,
        COUNT(*) FILTER (WHERE rating = 1)::INTEGER AS one_star
      FROM reviews
    `),

    
    db.query(`
      SELECT
        p.id                                            AS product_id,
        p.name                                          AS product_name,
        p.brand,
        json_build_object('id', c.id, 'name', c.name)  AS category,
        ROUND(AVG(r.rating), 2)                         AS avg_rating,
        COUNT(r.id)::INTEGER                            AS review_count
      FROM reviews r
      JOIN products p    ON r.product_id   = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, c.id
      HAVING COUNT(r.id) >= 3
      ORDER BY avg_rating DESC, review_count DESC
      LIMIT $1
    `, [safeLimit]),

    
    db.query(`
      SELECT
        p.id                                            AS product_id,
        p.name                                          AS product_name,
        p.brand,
        json_build_object('id', c.id, 'name', c.name)  AS category,
        ROUND(AVG(r.rating), 2)                         AS avg_rating,
        COUNT(r.id)::INTEGER                            AS review_count
      FROM reviews r
      JOIN products p    ON r.product_id   = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, c.id
      HAVING COUNT(r.id) >= 3
      ORDER BY avg_rating ASC, review_count DESC
      LIMIT $1
    `, [safeLimit]),

    
    db.query(`
      SELECT
        p.id                                            AS product_id,
        p.name                                          AS product_name,
        p.brand,
        json_build_object('id', c.id, 'name', c.name)  AS category,
        COUNT(r.id)::INTEGER                            AS review_count,
        ROUND(AVG(r.rating), 2)                         AS avg_rating
      FROM reviews r
      JOIN products p    ON r.product_id   = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, c.id
      ORDER BY review_count DESC
      LIMIT $1
    `, [safeLimit]),
  ]);

  const summary = summaryRes.rows[0];

  return {
    summary: {
      total_reviews:       summary.total_reviews,
      avg_platform_rating: summary.avg_platform_rating
        ? Number(summary.avg_platform_rating) : null,
      rating_distribution: {
        5: summary.five_star,
        4: summary.four_star,
        3: summary.three_star,
        2: summary.two_star,
        1: summary.one_star,
      },
    },
    top_rated:     topRatedRes.rows,
    lowest_rated:  lowestRatedRes.rows,
    most_reviewed: mostReviewedRes.rows,
  };
};





exports.getDashboard = async () => {
  
  const [
    overview,
    revenueData,
    topProducts,
    inventoryData,
    reviewData,
  ] = await Promise.all([
    exports.getOverview(),
    exports.getRevenue({ period: 'monthly' }),
    exports.getTopProducts({ limit: 5 }),
    exports.getInventoryAnalytics({ limit: 10 }),
    exports.getReviewAnalytics({ limit: 5 }),
  ]);

  
  const recentOrdersRes = await db.query(`
    SELECT
      DATE_TRUNC('day', created_at)  AS day,
      COUNT(*)::INTEGER              AS order_count,
      COALESCE(SUM(total_amount), 0) AS revenue
    FROM orders
    WHERE created_at >= NOW() - INTERVAL '7 days'
      AND status != 'cancelled'
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY day ASC
  `);

  return {
    overview,
    revenue_last_12_months: revenueData.data.slice(0, 12),
    recent_7_days: recentOrdersRes.rows.map(r => ({
      day:         r.day,
      order_count: r.order_count,
      revenue:     Number(r.revenue),
    })),
    top_products: topProducts,
    inventory: {
      low_stock:    inventoryData.low_stock,
      out_of_stock: inventoryData.out_of_stock,
    },
    reviews: {
      summary:   reviewData.summary,
      top_rated: reviewData.top_rated,
    },
  };
};