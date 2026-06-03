const db = require('../config/db');

/**
 * Delete refresh tokens that are safe to remove:
 *
 *  1. Tokens that expired more than 30 days ago (regardless of revocation).
 *     The 30-day buffer preserves revoked tokens long enough to catch
 *     any replay attempts before they disappear from the ledger.
 *
 *  2. Tokens that were explicitly revoked more than 30 days ago.
 *
 * Safe to run as often as daily. Call it from a cron job, a startup
 * task, or expose it as an internal admin endpoint.
 */
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


/* ──────────────────────────────────────────────────────────────
   HOW TO SCHEDULE THIS
   ──────────────────────────────────────────────────────────────

   Option A — node-cron (simplest, runs inside your process):

     npm install node-cron

     // in server.js, after socket.init(server):
     const cron         = require('node-cron');
     const tokenCleanup = require('./services/tokenCleanup.service');

     // runs every day at 03:00
     cron.schedule('0 3 * * *', () => {
       tokenCleanup.cleanupExpiredTokens().catch(console.error);
     });


   Option B — pg_cron (runs inside Postgres, no app dependency):

     SELECT cron.schedule(
       'cleanup-refresh-tokens',
       '0 3 * * *',
       $$
         DELETE FROM refresh_tokens
         WHERE expires_at  < NOW() - INTERVAL '30 days'
            OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days')
       $$
     );

   ──────────────────────────────────────────────────────────────*/
