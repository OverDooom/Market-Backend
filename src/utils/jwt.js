const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_TOKEN_EXPIRY      = '15m';
const REFRESH_TOKEN_BYTES      = 64;   // 128 hex chars
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

// =========================================
// ACCESS TOKEN  (JWT, short-lived)
// =========================================

exports.generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
};

exports.verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// =========================================
// REFRESH TOKEN  (opaque random bytes)
// Stored in the DB as a SHA-256 hash.
// The raw token is only ever returned to the
// client — never persisted in plaintext.
// =========================================

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

// =========================================
// BACKWARDS-COMPATIBLE ALIASES
// auth.middleware.js uses jsonwebtoken directly
// so no change needed there, but keep these
// aliases so nothing else breaks.
// =========================================

exports.generateToken = exports.generateAccessToken;
exports.verifyToken   = exports.verifyAccessToken;
