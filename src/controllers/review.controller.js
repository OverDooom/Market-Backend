const reviewService = require('../services/review.service');

// CREATE REVIEW
exports.createReview = async (req, res, next) => {
  try {

    const productId = parseInt(
      req.params.productId
    );

    const review =
      await reviewService.createReview(
        req.user.id,
        productId,
        req.body
      );

    res.status(201).json(review);

  } catch (err) {
    next(err);
  }
};

// GET PRODUCT REVIEWS
exports.getProductReviews =
async (req, res, next) => {
  try {

    const productId = parseInt(
      req.params.productId
    );

    const reviews =
      await reviewService.getProductReviews(
        productId
      );

    res.json(reviews);

  } catch (err) {
    next(err);
  }
};

// UPDATE REVIEW
exports.updateReview =
async (req, res, next) => {
  try {

    const review =
      await reviewService.updateReview(
        req.params.id,
        req.user.id,
        req.body
      );

    res.json(review);

  } catch (err) {
    next(err);
  }
};

// DELETE REVIEW
exports.deleteReview =
async (req, res, next) => {
  try {

    const deleted =
      await reviewService.deleteReview(
        req.params.id,
        req.user.id
      );

    res.json(deleted);

  } catch (err) {
    next(err);
  }
};