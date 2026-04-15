const adminService = require('../services/admin.service');

exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await adminService.getAllUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await adminService.getUser(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    await adminService.deleteUser(req.params.id);
    res.json({ message: "User deleted" });
  } catch (err) {
    next(err);
  }
};
