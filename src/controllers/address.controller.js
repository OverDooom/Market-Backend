const addressService = require('../services/address.service');


exports.getAddresses = async (req, res, next) => {
  try {
    const addresses = await addressService.getAddresses(req.user.id);
    res.json(addresses);
  } catch (err) {
    next(err);
  }
};


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


exports.createAddress = async (req, res, next) => {
  try {
    const address = await addressService.createAddress(req.user.id, req.body);
    res.status(201).json(address);
  } catch (err) {
    next(err);
  }
};


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
