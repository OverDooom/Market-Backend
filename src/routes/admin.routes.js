const express = require('express');
const router  = express.Router();

const adminController = require('../controllers/admin.controller');
const auth            = require('../middleware/auth.middleware');
const role            = require('../middleware/role.middleware');

// Every route in this file requires a valid JWT + admin role
const guard = [auth, role(['admin'])];

// =========================================
// DASHBOARD
// =========================================

// GET /api/admin/dashboard
router.get('/dashboard', ...guard, adminController.getDashboardStats);

// =========================================
// USERS
// =========================================

// GET  /api/admin/users
// GET  /api/admin/users?search=john&role=user&page=1&limit=20
router.get   ('/users',              ...guard, adminController.getAllUsers);

// GET  /api/admin/users/:id
router.get   ('/users/:id',          ...guard, adminController.getUser);

// PUT  /api/admin/users/:id
// Body: { name?, email?, phone?, role? }
router.put   ('/users/:id',          ...guard, adminController.updateUser);

// DELETE /api/admin/users/:id
router.delete('/users/:id',          ...guard, adminController.deleteUser);

// GET /api/admin/users/:id/orders
router.get   ('/users/:id/orders',   ...guard, adminController.getUserOrders);

// GET /api/admin/users/:id/reviews
router.get   ('/users/:id/reviews',  ...guard, adminController.getUserReviews);

// GET /api/admin/users/:id/wishlist
router.get   ('/users/:id/wishlist', ...guard, adminController.getUserWishlist);

// =========================================
// ORDERS
// =========================================

// GET /api/admin/orders
// GET /api/admin/orders?status=pending&user_id=5&page=1&limit=20
router.get('/orders',     ...guard, adminController.getAllOrders);

// GET /api/admin/orders/:id
router.get('/orders/:id', ...guard, adminController.getOrderById);

// =========================================
// REVIEWS
// =========================================

// GET    /api/admin/reviews
// GET    /api/admin/reviews?product_id=3&rating=1&page=1&limit=20
router.get   ('/reviews',     ...guard, adminController.getAllReviews);

// DELETE /api/admin/reviews/:id  (moderation)
router.delete('/reviews/:id', ...guard, adminController.deleteReview);

// =========================================
// NOTIFICATIONS
// =========================================

// GET  /api/admin/notifications
router.get   ('/notifications',     ...guard, adminController.getAllNotifications);

// POST /api/admin/notifications
// Body: { title, message, type?, reference_id?,
//         user_ids?: [1,2,3], broadcast_all?: true }
router.post  ('/notifications',     ...guard, adminController.sendNotification);

// DELETE /api/admin/notifications/:id
router.delete('/notifications/:id', ...guard, adminController.deleteNotification);

// =========================================
// WISHLIST
// =========================================

// GET /api/admin/wishlist/stats
// GET /api/admin/wishlist/stats?limit=20
router.get('/wishlist/stats', ...guard, adminController.getWishlistStats);

// =========================================
// PROMOTIONS
// =========================================

// GET    /api/admin/promotions
// GET    /api/admin/promotions?active=true
router.get   ('/promotions',     ...guard, adminController.listPromotions);

// GET    /api/admin/promotions/:id
router.get   ('/promotions/:id', ...guard, adminController.getPromotion);

// POST   /api/admin/promotions
// Body: { name, type, value, is_automatic, stackable, coupon_required,
//         start_date?, end_date?, usage_limit?, usage_per_user?,
//         min_cart_total?, first_order_only?,
//         product_ids?: [], category_ids?: [], user_ids?: [],
//         coupons?: [{ code, usage_limit?, expires_at? }] }
router.post  ('/promotions',     ...guard, adminController.createPromotion);

// PUT    /api/admin/promotions/:id
router.put   ('/promotions/:id', ...guard, adminController.updatePromotion);

// PATCH  /api/admin/promotions/:id/toggle  — flip is_active
router.patch ('/promotions/:id/toggle', ...guard, adminController.togglePromotion);

// DELETE /api/admin/promotions/:id  (blocked if usage exists)
router.delete('/promotions/:id', ...guard, adminController.deletePromotion);

// GET    /api/admin/promotions/:id/usage
router.get   ('/promotions/:id/usage', ...guard, adminController.getPromotionUsage);

// POST   /api/admin/promotions/:id/coupons
// Body: { coupons: [{ code, usage_limit?, expires_at? }] }
router.post  ('/promotions/:id/coupons', ...guard, adminController.addCoupons);

// PATCH  /api/admin/promotions/:id/coupons/:couponId/toggle
router.patch ('/promotions/:id/coupons/:couponId/toggle', ...guard, adminController.toggleCoupon);

// DELETE /api/admin/promotions/:id/coupons/:couponId
router.delete('/promotions/:id/coupons/:couponId', ...guard, adminController.deleteCoupon);

module.exports = router;
