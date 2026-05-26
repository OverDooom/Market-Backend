const adminService              = require('../services/admin.service');
const promotionAdminService     = require('../services/promotion.admin.service');

// =========================================
// DASHBOARD
// =========================================

exports.getDashboardStats = async (req, res, next) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
};

// =========================================
// USERS
// =========================================

exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await adminService.getAllUsers({
      search: req.query.search || undefined,
      role:   req.query.role   || undefined,
      page:   parseInt(req.query.page)  || 1,
      limit:  parseInt(req.query.limit) || 20,
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await adminService.getUser(parseInt(req.params.id));
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const user = await adminService.updateUser(
      parseInt(req.params.id),
      req.body
    );
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const deleted = await adminService.deleteUser(parseInt(req.params.id));
    res.json(deleted);
  } catch (err) {
    next(err);
  }
};

exports.getUserOrders = async (req, res, next) => {
  try {
    const orders = await adminService.getUserOrders(parseInt(req.params.id));
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

exports.getUserReviews = async (req, res, next) => {
  try {
    const reviews = await adminService.getUserReviews(parseInt(req.params.id));
    res.json(reviews);
  } catch (err) {
    next(err);
  }
};

exports.getUserWishlist = async (req, res, next) => {
  try {
    const items = await adminService.getUserWishlist(parseInt(req.params.id));
    res.json(items);
  } catch (err) {
    next(err);
  }
};

// =========================================
// ORDERS
// =========================================

exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await adminService.getAllOrders({
      status: req.query.status || undefined,
      userId: req.query.user_id ? parseInt(req.query.user_id) : undefined,
      page:   parseInt(req.query.page)  || 1,
      limit:  parseInt(req.query.limit) || 20,
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const order = await adminService.getOrderByIdAdmin(parseInt(req.params.id));
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// =========================================
// REVIEWS
// =========================================

exports.getAllReviews = async (req, res, next) => {
  try {
    const reviews = await adminService.getAllReviews({
      productId: req.query.product_id ? parseInt(req.query.product_id) : undefined,
      rating:    req.query.rating     ? parseInt(req.query.rating)     : undefined,
      page:      parseInt(req.query.page)  || 1,
      limit:     parseInt(req.query.limit) || 20,
    });
    res.json(reviews);
  } catch (err) {
    next(err);
  }
};

exports.deleteReview = async (req, res, next) => {
  try {
    const deleted = await adminService.deleteReview(parseInt(req.params.id));
    res.json(deleted);
  } catch (err) {
    next(err);
  }
};

// =========================================
// NOTIFICATIONS
// =========================================

exports.getAllNotifications = async (req, res, next) => {
  try {
    const notifications = await adminService.getAllNotifications({
      page:  parseInt(req.query.page)  || 1,
      limit: parseInt(req.query.limit) || 30,
    });
    res.json(notifications);
  } catch (err) {
    next(err);
  }
};

exports.sendNotification = async (req, res, next) => {
  try {
    const {
      title,
      message,
      type         = 'admin',
      reference_id = null,
      user_ids     = [],
      broadcast_all = false,
    } = req.body;

    const notification = await adminService.sendNotification({
      title,
      message,
      type,
      referenceId:  reference_id,
      userIds:      user_ids,
      broadcastAll: broadcast_all,
    });

    res.status(201).json(notification);
  } catch (err) {
    next(err);
  }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    const deleted = await adminService.deleteNotification(
      parseInt(req.params.id)
    );
    res.json(deleted);
  } catch (err) {
    next(err);
  }
};

// =========================================
// WISHLIST
// =========================================

exports.getWishlistStats = async (req, res, next) => {
  try {
    const stats = await adminService.getWishlistStats({
      limit: parseInt(req.query.limit) || 20,
    });
    res.json(stats);
  } catch (err) {
    next(err);
  }
};

// =========================================
// PROMOTIONS  (delegates to promotion admin service)
// =========================================

exports.listPromotions = async (req, res, next) => {
  try {
    let active;
    if (req.query.active !== undefined) active = req.query.active === 'true';
    res.json(await promotionAdminService.listPromotions({ active }));
  } catch (err) { next(err); }
};

exports.getPromotion = async (req, res, next) => {
  try {
    res.json(await promotionAdminService.getPromotion(parseInt(req.params.id)));
  } catch (err) { next(err); }
};

exports.createPromotion = async (req, res, next) => {
  try {
    res.status(201).json(await promotionAdminService.createPromotion(req.body));
  } catch (err) { next(err); }
};

exports.updatePromotion = async (req, res, next) => {
  try {
    res.json(await promotionAdminService.updatePromotion(parseInt(req.params.id), req.body));
  } catch (err) { next(err); }
};

exports.togglePromotion = async (req, res, next) => {
  try {
    res.json(await promotionAdminService.togglePromotion(parseInt(req.params.id)));
  } catch (err) { next(err); }
};

exports.deletePromotion = async (req, res, next) => {
  try {
    res.json(await promotionAdminService.deletePromotion(parseInt(req.params.id)));
  } catch (err) { next(err); }
};

exports.getPromotionUsage = async (req, res, next) => {
  try {
    res.json(await promotionAdminService.getUsageStats(parseInt(req.params.id)));
  } catch (err) { next(err); }
};

exports.addCoupons = async (req, res, next) => {
  try {
    res.status(201).json(
      await promotionAdminService.addCoupons(parseInt(req.params.id), req.body.coupons)
    );
  } catch (err) { next(err); }
};

exports.toggleCoupon = async (req, res, next) => {
  try {
    res.json(
      await promotionAdminService.toggleCoupon(
        parseInt(req.params.id),
        parseInt(req.params.couponId)
      )
    );
  } catch (err) { next(err); }
};

exports.deleteCoupon = async (req, res, next) => {
  try {
    res.json(
      await promotionAdminService.deleteCoupon(
        parseInt(req.params.id),
        parseInt(req.params.couponId)
      )
    );
  } catch (err) { next(err); }
};
