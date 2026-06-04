const rateLimit = require('express-rate-limit');

// In the test environment the entire auth suite fires 20+ requests
// against the same routes inside one 15-minute window, which causes
// every test after the first ~20 to receive 429 instead of the real
// response. Disabling the limiter for NODE_ENV=test is the standard
// approach — the limiter logic itself is a library concern and doesn't
// need to be tested here.
const isTest = process.env.NODE_ENV === 'test';

exports.authLimiter = isTest
  ? (req, res, next) => next()   // no-op passthrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      message: {
        error: 'Too many requests from this IP, please try again after 15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });