const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_TOKEN_EXPIRY      = '15m';
const REFRESH_TOKEN_BYTES      = 64;   
const REFRESH_TOKEN_EXPIRY_DAYS = 7;





exports.generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
};

exports.verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};








exports.generateRefreshToken = () => {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
};

exports.hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

exports.refreshTokenExpiresAt = () => {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return d;
};








exports.generateToken = exports.generateAccessToken;
exports.verifyToken   = exports.verifyAccessToken;
