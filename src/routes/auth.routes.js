const express = require('express');
const router  = express.Router();

const authController      = require('../controllers/auth.controller');
const { authLimiter }     = require('../middleware/rateLimiter.middleware');
const auth                = require('../middleware/auth.middleware');

router.post('/register', authLimiter, authController.register);

router.post('/login', authLimiter, authController.login);

router.post('/refresh', authLimiter, authController.refresh);

router.post('/logout', authController.logout);

router.post('/logout-all', auth, authController.logoutAll);

module.exports = router;
