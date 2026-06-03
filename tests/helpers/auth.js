const jwt = require('jsonwebtoken');

exports.adminToken = () =>
  jwt.sign(
    {
      id: 1,
      role: 'admin'
    },
    process.env.JWT_SECRET
  );

exports.userToken = () =>
  jwt.sign(
    {
      id: 2,
      role: 'user'
    },
    process.env.JWT_SECRET
  );