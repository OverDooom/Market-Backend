const express = require('express');
const router = express.Router();

const userController = require('../controllers/user.controller');
const auth = require('../middleware/auth.middleware');

// GET user profile
router.get('/me', auth, userController.getProfile);

// UPDATE user profile
router.put('/me', auth, userController.updateProfile);

module.exports = router;
