const express = require('express');
const router = express.Router();

const addressController = require('../controllers/address.controller');
const auth = require('../middleware/auth.middleware');


router.get('/', auth, addressController.getAddresses);


router.get('/:id', auth, addressController.getAddressById);


router.post('/', auth, addressController.createAddress);


router.put('/:id', auth, addressController.updateAddress);


router.delete('/:id', auth, addressController.deleteAddress);

module.exports = router;
