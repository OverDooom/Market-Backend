const express = require('express');

const router = express.Router();

const auth =
require('../middleware/auth.middleware');

const pricingController =
require('../controllers/pricing.controller');


// PREVIEW CART PRICING
router.post(
  '/cart',
  auth,
  pricingController.getCartPricing
);

module.exports = router;