const express = require('express');
const router = express.Router();

const userController = require('../controllers/user.controller');
const auth = require('../middleware/auth.middleware');

router.get('/me', auth, userController.getProfile);
router.put('/me', auth, userController.updateProfile);

module.exports = router;
