// src/middleware/error.middleware.js

module.exports = (err, req, res, next) => {
  console.error(err);

  // Custom known error
  if (err.message === 'Invalid category_id') {
    return res.status(400).json({
      error: err.message
    });
  }

  res.status(500).json({
    error: 'Internal Server Error'
  });
};