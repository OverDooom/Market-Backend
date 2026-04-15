const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');
const auth = require('../middleware/auth.middleware');
const role = require('../middleware/role.middleware');

//GET all users
router.get('/users', auth, role(['admin']), adminController.getAllUsers);

//GET user by ID
router.get('/users/:id', auth, role(['admin']), adminController.getUser);

//DELETE user by ID
router.delete('/users/:id', auth, role(['admin']), adminController.deleteUser);

module.exports = router;
