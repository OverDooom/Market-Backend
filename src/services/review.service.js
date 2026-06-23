const db = require('../config/db');
const { optionalStr } = require('../utils/sanitize');

exports.createReview = async (
  userId,
  productId,
  data
) => {

  const rating  = parseInt(data.rating);
  const comment = optionalStr(data.comment, 'comment', 1000);

  
  if (!data.rating || isNaN(rating) || rating < 1 || rating > 5) {
    const err = new Error('Rating must be between 1 and 5');
    err.status = 400;
    throw err;
  }

  
  const product = await db.query(
    `SELECT id
     FROM products
     WHERE id = $1`,
    [productId]
  );

  if (product.rows.length === 0) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  
  const existing = await db.query(
    `SELECT id
     FROM reviews
     WHERE user_id = $1
     AND product_id = $2`,
    [userId, productId]
  );

  if (existing.rows.length > 0) {
    const err = new Error(
      'You already reviewed this product'
    );

    err.status = 400;
    throw err;
  }

  const result = await db.query(
    `INSERT INTO reviews
     (
       user_id,
       product_id,
       rating,
       comment
     )
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      userId,
      productId,
      rating,
      comment || null
    ]
  );

  return result.rows[0];
};


exports.getProductReviews = async (productId) => {

  const result = await db.query(
    `SELECT
        r.id,
        r.rating,
        r.comment,
        r.created_at,

        json_build_object(
          'id', u.id,
          'name', u.name
        ) AS user

     FROM reviews r

     JOIN users u
       ON r.user_id = u.id

     WHERE r.product_id = $1

     ORDER BY r.created_at DESC`,
    [productId]
  );

  return result.rows;
};


exports.updateReview = async (reviewId, userId, data) => {
  const existing = await db.query(
    `SELECT * FROM reviews WHERE id = $1`,
    [reviewId]
  );

  const review = existing.rows[0];

  if (!review) {
    const err = new Error('Review not found');
    err.status = 404;
    throw err;
  }

  if (review.user_id !== userId) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  
  const newRating  = data.rating  !== undefined ? parseInt(data.rating)  : review.rating;
  const newComment = data.comment !== undefined
    ? optionalStr(data.comment, 'comment', 1000)
    : review.comment;

  if (isNaN(newRating) || newRating < 1 || newRating > 5) {
    const err = new Error('Rating must be between 1 and 5');
    err.status = 400;
    throw err;
  }

  const result = await db.query(
    `UPDATE reviews SET rating = $1, comment = $2 WHERE id = $3 RETURNING *`,
    [newRating, newComment, reviewId]
  );

  return result.rows[0];
};


exports.deleteReview = async (
  reviewId,
  userId
) => {

  const existing = await db.query(
    `SELECT *
     FROM reviews
     WHERE id = $1`,
    [reviewId]
  );

  const review = existing.rows[0];

  if (!review) {
    const err = new Error('Review not found');
    err.status = 404;
    throw err;
  }

  if (review.user_id !== userId) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  const result = await db.query(
    `DELETE FROM reviews
     WHERE id = $1
     RETURNING *`,
    [reviewId]
  );

  return result.rows[0];
};