const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/auth.middleware');
const role       = require('../middleware/role.middleware');
const controller = require('../controllers/analytics.controller');

const guard = [auth, role(['admin'])];


router.get('/dashboard',   ...guard, controller.getDashboard);


router.get('/overview',    ...guard, controller.getOverview);


router.get('/revenue',     ...guard, controller.getRevenue);


router.get('/orders',      ...guard, controller.getOrderAnalytics);


router.get('/top-products',   ...guard, controller.getTopProducts);


router.get('/top-categories', ...guard, controller.getTopCategories);


router.get('/users',       ...guard, controller.getUserAnalytics);


router.get('/promotions',  ...guard, controller.getPromotionAnalytics);


router.get('/inventory',   ...guard, controller.getInventoryAnalytics);


router.get('/reviews',     ...guard, controller.getReviewAnalytics);

module.exports = router;