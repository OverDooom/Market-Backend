const db = require('../config/db');

module.exports = (req, res, next) => {
  if (req.user && req.params.id) {
    const productId = parseInt(req.params.id);
    const userId    = req.user.id;

    if (!isNaN(productId)) {
      db.query(
        `INSERT INTO product_views (product_id, user_id) VALUES ($1, $2)`,
        [productId, userId]
      ).catch(err => {
        console.error('[product_views] failed to record:', err.message);
      });
    }
  }

  next();
};