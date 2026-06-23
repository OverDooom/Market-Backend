const express = require('express');
const router  = express.Router();

const adminController = require('../controllers/admin.controller');
const auth            = require('../middleware/auth.middleware');
const role            = require('../middleware/role.middleware');


const guard = [auth, role(['admin'])];

router.get('/dashboard', ...guard, adminController.getDashboardStats);


router.get   ('/users',              ...guard, adminController.getAllUsers);

router.get   ('/users/:id',          ...guard, adminController.getUser);

router.put   ('/users/:id',          ...guard, adminController.updateUser);

router.delete('/users/:id',          ...guard, adminController.deleteUser);

router.get   ('/users/:id/orders',   ...guard, adminController.getUserOrders);

router.get   ('/users/:id/reviews',  ...guard, adminController.getUserReviews);

router.get   ('/users/:id/wishlist', ...guard, adminController.getUserWishlist);

router.get('/orders',     ...guard, adminController.getAllOrders);

router.get('/orders/:id', ...guard, adminController.getOrderById);

router.get   ('/reviews',     ...guard, adminController.getAllReviews);

router.delete('/reviews/:id', ...guard, adminController.deleteReview);

router.get   ('/notifications',     ...guard, adminController.getAllNotifications);

router.post  ('/notifications',     ...guard, adminController.sendNotification);

router.delete('/notifications/:id', ...guard, adminController.deleteNotification);

router.get('/wishlist/stats', ...guard, adminController.getWishlistStats);

router.get   ('/promotions',     ...guard, adminController.listPromotions);

router.get   ('/promotions/:id', ...guard, adminController.getPromotion);

router.post  ('/promotions',     ...guard, adminController.createPromotion);

router.put   ('/promotions/:id', ...guard, adminController.updatePromotion);

router.patch ('/promotions/:id/toggle', ...guard, adminController.togglePromotion);

router.delete('/promotions/:id', ...guard, adminController.deletePromotion);

router.get   ('/promotions/:id/usage', ...guard, adminController.getPromotionUsage);

router.post  ('/promotions/:id/coupons', ...guard, adminController.addCoupons);

router.patch ('/promotions/:id/coupons/:couponId/toggle', ...guard, adminController.toggleCoupon);

router.delete('/promotions/:id/coupons/:couponId', ...guard, adminController.deleteCoupon);

module.exports = router;
