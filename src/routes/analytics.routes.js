const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/auth.middleware');
const role       = require('../middleware/role.middleware');
const controller = require('../controllers/analytics.controller');

const guard = [auth, role(['admin'])];

// GET /api/admin/analytics/dashboard
router.get('/dashboard',   ...guard, controller.getDashboard);

// GET /api/admin/analytics/overview
router.get('/overview',    ...guard, controller.getOverview);

// GET /api/admin/analytics/revenue?period=monthly|daily|weekly|yearly
router.get('/revenue',     ...guard, controller.getRevenue);

// GET /api/admin/analytics/orders?period=monthly|daily|weekly|yearly
router.get('/orders',      ...guard, controller.getOrderAnalytics);

// GET /api/admin/analytics/top-products?limit=10
router.get('/top-products',   ...guard, controller.getTopProducts);

// GET /api/admin/analytics/top-categories?limit=10
router.get('/top-categories', ...guard, controller.getTopCategories);

// GET /api/admin/analytics/users?limit=10
router.get('/users',       ...guard, controller.getUserAnalytics);

// GET /api/admin/analytics/promotions
router.get('/promotions',  ...guard, controller.getPromotionAnalytics);

// GET /api/admin/analytics/inventory?limit=20
router.get('/inventory',   ...guard, controller.getInventoryAnalytics);

// GET /api/admin/analytics/reviews?limit=10
router.get('/reviews',     ...guard, controller.getReviewAnalytics);

module.exports = router;