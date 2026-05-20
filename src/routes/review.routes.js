const express = require('express');
const router = express.Router();

const reviewController =
require('../controllers/review.controller');

const auth =
require('../middleware/auth.middleware');

router.post(
  '/product/:productId',
  auth,
  reviewController.createReview
);

router.get(
  '/product/:productId',
  reviewController.getProductReviews
);

router.put(
  '/:id',
  auth,
  reviewController.updateReview
);

router.delete(
  '/:id',
  auth,
  reviewController.deleteReview
);

module.exports = router;