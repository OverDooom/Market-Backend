const db = require('../config/db');

// =========================================
// RECORD A SINGLE MOVEMENT
// =========================================

/**
 * Insert one row into inventory_transactions.
 *
 * @param {object} opts
 * @param {*}       opts.client        - pg client (for transactions) or pool
 * @param {number}  opts.variantId
 * @param {number}  opts.change        - positive = added, negative = removed
 * @param {string}  opts.reason        - 'checkout' | 'cancellation' | 'admin_edit' | 'restock'
 * @param {number}  [opts.referenceId] - e.g. order id
 * @param {string}  [opts.referenceType] - e.g. 'order' | 'manual'
 * @param {number}  [opts.createdBy]   - user / admin id
 */
exports.record = async ({
  client       = db,
  variantId,
  change,
  reason,
  referenceId   = null,
  referenceType = null,
  createdBy     = null,
}) => {
  await client.query(
    `INSERT INTO inventory_transactions
       (variant_id, change, reason, reference_id, reference_type, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [variantId, change, reason, referenceId, referenceType, createdBy]
  );
};

// =========================================
// RECORD MOVEMENTS FOR MULTIPLE ITEMS
// =========================================

/**
 * Convenience wrapper for checkout / cancellation where every
 * cart/order item needs its own row.
 *
 * @param {object}   opts
 * @param {*}        opts.client
 * @param {object[]} opts.items       - array of { variant_id, quantity }
 * @param {number}   opts.multiplier  - -1 for deduction, +1 for restock
 * @param {string}   opts.reason
 * @param {number}   [opts.referenceId]
 * @param {string}   [opts.referenceType]
 * @param {number}   [opts.createdBy]
 */
exports.recordBulk = async ({
  client        = db,
  items,
  multiplier,
  reason,
  referenceId   = null,
  referenceType = null,
  createdBy     = null,
}) => {
  for (const item of items) {
    await exports.record({
      client,
      variantId:    item.variant_id,
      change:       multiplier * item.quantity,
      reason,
      referenceId,
      referenceType,
      createdBy,
    });
  }
};

// =========================================
// GET HISTORY FOR A VARIANT
// =========================================

exports.getVariantHistory = async (variantId) => {
  const result = await db.query(
    `SELECT
        it.*,
        json_build_object('id', u.id, 'name', u.name) AS actor
     FROM inventory_transactions it
     LEFT JOIN users u ON it.created_by = u.id
     WHERE it.variant_id = $1
     ORDER BY it.created_at DESC`,
    [variantId]
  );

  return result.rows;
};
