// src/middleware/error.middleware.js
module.exports = (err, req, res, next) => {
    if (process.env.NODE_ENV !== 'test') console.error(err);

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
};