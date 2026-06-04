const db                    = require('../config/db');
const jwtUtils              = require('../utils/jwt');
const { hashPassword, comparePassword } = require('../utils/hash');
const { randomUUID }        = require('crypto');


// =========================================
// HELPERS
// =========================================

/**
 * Generate an access + refresh token pair, store the refresh
 * token hash in the DB, and return both raw tokens to the caller.
 *
 * @param {object} user      - { id, role_name }
 * @param {string} familyId  - UUID shared by all tokens in this login session
 * @param {*}      client    - pg client or pool
 */
async function createTokenPair(user, familyId, client = db) {
  const accessToken  = jwtUtils.generateAccessToken({
    id:   user.id,
    role: user.role_name,
  });

  const refreshToken = jwtUtils.generateRefreshToken();
  const tokenHash    = jwtUtils.hashToken(refreshToken);
  const expiresAt    = jwtUtils.refreshTokenExpiresAt();

  await client.query(
    `INSERT INTO refresh_tokens
       (user_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [user.id, tokenHash, familyId, expiresAt]
  );

  return { accessToken, refreshToken };
}

// =========================================
// REGISTER
// =========================================

exports.register = async ({ name, email, password }) => {
  if (!email || !password) {
    const err = new Error('Email and password are required');
    err.status = 400;
    throw err;
  }

  const existing = await db.query(
    `SELECT id FROM users WHERE email = $1`,
    [email]
  );

  if (existing.rows.length > 0) {
    const err = new Error('Email already exists');
    err.status = 400;
    throw err;
  }

  const hashed = await hashPassword(password);

  const result = await db.query(
    `INSERT INTO users (name, email, password_hash, role_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email`,
    [name, email, hashed, 1]
  );

  return result.rows[0];
};

// =========================================
// LOGIN
// =========================================

exports.login = async ({ email, password }) => {
  if (!email || !password) {
    const err = new Error('Email and password are required');
    err.status = 400;
    throw err;
  }

  const result = await db.query(
    `SELECT u.*, r.name AS role_name
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.email = $1`,
    [email]
  );

  const user = result.rows[0];

  if (!user) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const valid = await comparePassword(password, user.password_hash);

  if (!valid) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  // Each login starts a new token family (fresh UUID)

  const familyId = randomUUID();

  const { accessToken, refreshToken } = await createTokenPair(
    user,
    familyId
  );

  return {
    access_token:  accessToken,
    refresh_token: refreshToken,
    user: {
      id:    user.id,
      name:  user.name,
      email: user.email,
    },
  };
};

// =========================================
// REFRESH  (rotation)
// =========================================

exports.refresh = async (rawRefreshToken) => {
  if (!rawRefreshToken) {
    const err = new Error('Refresh token required');
    err.status = 401;
    throw err;
  }

  const tokenHash = jwtUtils.hashToken(rawRefreshToken);

  // Look up the token — join user + role so we can rebuild the access token
  const tokenRes = await db.query(
    `SELECT
        rt.*,
        r.name AS role_name
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     JOIN roles r ON u.role_id  = r.id
     WHERE rt.token_hash = $1`,
    [tokenHash]
  );

  const stored = tokenRes.rows[0];

  // Token not found at all
  if (!stored) {
    const err = new Error('Invalid refresh token');
    err.status = 401;
    throw err;
  }

  // ── Reuse detection ──────────────────────────────────────────
  // If the token is already revoked, someone is replaying an old
  // token. Assume the family is compromised: revoke every live
  // token in the family and force the user to log in again.
  // ─────────────────────────────────────────────────────────────
  if (stored.revoked_at) {
    await db.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE family_id = $1
         AND revoked_at IS NULL`,
      [stored.family_id]
    );

    const err = new Error(
      'Refresh token already used. Possible token theft detected — please log in again.'
    );
    err.status = 401;
    throw err;
  }

  // Expired
  if (new Date(stored.expires_at) < new Date()) {
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
      [stored.id]
    );

    const err = new Error('Refresh token expired. Please log in again.');
    err.status = 401;
    throw err;
  }

  // ── Rotate ───────────────────────────────────────────────────
  // Generate a new pair, revoke the old token (recording which
  // token replaced it), keep the same family_id.
  // ─────────────────────────────────────────────────────────────
  const newRefreshToken = jwtUtils.generateRefreshToken();
  const newHash         = jwtUtils.hashToken(newRefreshToken);
  const expiresAt       = jwtUtils.refreshTokenExpiresAt();

  const accessToken = jwtUtils.generateAccessToken({
    id:   stored.user_id,
    role: stored.role_name,
  });

  // Revoke old, store new — both in one transaction
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE refresh_tokens
       SET revoked_at  = NOW(),
           replaced_by = $1
       WHERE id = $2`,
      [newHash, stored.id]
    );

    await client.query(
      `INSERT INTO refresh_tokens
         (user_id, token_hash, family_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [stored.user_id, newHash, stored.family_id, expiresAt]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    access_token:  accessToken,
    refresh_token: newRefreshToken,
  };
};

// =========================================
// LOGOUT
// =========================================

/**
 * Revoke a single refresh token.
 * The access token is short-lived (15 min) so we don't track it —
 * it will expire on its own.
 */
exports.logout = async (rawRefreshToken) => {
  if (!rawRefreshToken) {
    const err = new Error('Refresh token required');
    err.status = 400;
    throw err;
  }

  const tokenHash = jwtUtils.hashToken(rawRefreshToken);

  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1
       AND revoked_at IS NULL`,
    [tokenHash]
  );

  // We don't error if the token wasn't found or was already revoked —
  // the desired end state (token is invalid) is already true.
  return { message: 'Logged out successfully' };
};

// =========================================
// LOGOUT ALL DEVICES
// =========================================

/**
 * Revoke every live refresh token for a user.
 * Useful as a "sign out everywhere" feature or after a password change.
 */
exports.logoutAll = async (userId) => {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id    = $1
       AND revoked_at IS NULL`,
    [userId]
  );

  return { message: 'Logged out from all devices' };
};
