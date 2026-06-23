const rateLimit = require('express-rate-limit');







const isTest = process.env.NODE_ENV === 'test';

exports.authLimiter = isTest
  ? (req, res, next) => next()   
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      message: {
        error: 'Too many requests from this IP, please try again after 15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });