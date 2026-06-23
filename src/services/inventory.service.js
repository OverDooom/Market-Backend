const db = require('../config/db');

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
