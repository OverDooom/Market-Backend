const db = require('../config/db');













exports.cleanupExpiredTokens = async () => {
  const result = await db.query(
    `DELETE FROM refresh_tokens
     WHERE
       -- expired and old enough that reuse detection is no longer useful
       expires_at < NOW() - INTERVAL '30 days'

       OR

       -- explicitly revoked (logout / rotation) and past the buffer window
       (
         revoked_at IS NOT NULL
         AND revoked_at < NOW() - INTERVAL '30 days'
       )
     RETURNING id`
  );

  const count = result.rowCount;
  console.log(`[token-cleanup] Removed ${count} stale refresh token(s).`);
  return count;
};

































