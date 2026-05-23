const addressService = require('../services/address.service');

// GET all addresses
exports.getAddresses = async (req, res, next) => {
  try {
    const addresses = await addressService.getAddresses(req.user.id);
    res.json(addresses);
  } catch (err) {
    next(err);
  }
};

// GET single address
exports.getAddressById = async (req, res, next) => {
  try {
    const address = await addressService.getAddressById(
      req.params.id,
      req.user.id
    );
    res.json(address);
  } catch (err) {
    next(err);
  }
};

// CREATE address
exports.createAddress = async (req, res, next) => {
  try {
    const address = await addressService.createAddress(req.user.id, req.body);
    res.status(201).json(address);
  } catch (err) {
    next(err);
  }
};

// UPDATE address
exports.updateAddress = async (req, res, next) => {
  try {
    const address = await addressService.updateAddress(
      req.params.id,
      req.user.id,
      req.body
    );
    res.json(address);
  } catch (err) {
    next(err);
  }
};

// DELETE address
exports.deleteAddress = async (req, res, next) => {
  try {
    const address = await addressService.deleteAddress(
      req.params.id,
      req.user.id
    );
    res.json(address);
  } catch (err) {
    next(err);
  }
};
