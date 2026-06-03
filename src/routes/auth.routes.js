const express = require('express');
const router  = express.Router();

const authController      = require('../controllers/auth.controller');
const { authLimiter }     = require('../middleware/rateLimiter.middleware');
const auth                = require('../middleware/auth.middleware');

// POST /api/auth/register
router.post('/register', authLimiter, authController.register);

// POST /api/auth/login
// Returns: { access_token, refresh_token, user }
router.post('/login', authLimiter, authController.login);

// POST /api/auth/refresh
// Body:    { refresh_token }
// Returns: { access_token, refresh_token }
// Rate-limited to slow down token-refresh abuse
router.post('/refresh', authLimiter, authController.refresh);

// POST /api/auth/logout
// Body: { refresh_token }
// Revokes the provided refresh token.
// No auth middleware needed — if the access token is already
// expired the user should still be able to log out.
router.post('/logout', authController.logout);

// POST /api/auth/logout-all
// Requires valid access token. Revokes all refresh tokens for the user.
router.post('/logout-all', auth, authController.logoutAll);

module.exports = router;
