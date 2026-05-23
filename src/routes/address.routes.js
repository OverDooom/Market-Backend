const express = require('express');
const router = express.Router();

const addressController = require('../controllers/address.controller');
const auth = require('../middleware/auth.middleware');

// GET all my addresses
router.get('/', auth, addressController.getAddresses);

// GET single address
router.get('/:id', auth, addressController.getAddressById);

// CREATE address
router.post('/', auth, addressController.createAddress);

// UPDATE address
router.put('/:id', auth, addressController.updateAddress);

// DELETE address
router.delete('/:id', auth, addressController.deleteAddress);

module.exports = router;
