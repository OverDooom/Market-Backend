const db = require('../config/db');

// GET or CREATE cart for user
exports.getOrCreateCart = async (userId) => {
  let cart = await db.query(
    `SELECT * FROM carts WHERE user_id = $1`,
    [userId]
  );

  if (cart.rows.length > 0) {
    return cart.rows[0];
  }

  const newCart = await db.query(
    `INSERT INTO carts (user_id)
     VALUES ($1)
     RETURNING *`,
    [userId]
  );

  return newCart.rows[0];
};

// ADD item to cart
exports.addItem = async (cartId, variantId, quantity) => {
  const existing = await db.query(
    `SELECT * FROM cart_items 
     WHERE cart_id = $1 AND product_variant_id = $2`,
    [cartId, variantId]
  );

  if (existing.rows.length > 0) {
    const updated = await db.query(
      `UPDATE cart_items
       SET quantity = quantity + $1
       WHERE cart_id = $2 AND product_variant_id = $3
       RETURNING *`,
      [quantity, cartId, variantId]
    );

    return updated.rows[0];
  }

  const result = await db.query(
    `INSERT INTO cart_items (cart_id, product_variant_id, quantity)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [cartId, variantId, quantity]
  );

  return result.rows[0];
};

// GET cart with items
exports.getCart = async (userId) => {
  const cart = await exports.getOrCreateCart(userId);

  const items = await db.query(
    `SELECT 
        ci.id,
        ci.quantity,

        pv.id AS variant_id,
        pv.product_id,
        pv.price,
        pv.sku,

        p.name AS product_name,
        p.category_id

    FROM cart_items ci

    JOIN product_variants pv
      ON ci.product_variant_id = pv.id

    JOIN products p
      ON pv.product_id = p.id

    WHERE ci.cart_id = $1`,
    [cart.id]
  );

  return {
    cart,
    items: items.rows
  };
};

// REMOVE item
exports.removeItem = async (cartId, itemId) => {
  const result = await db.query(
    `DELETE FROM cart_items
     WHERE id = $1 AND cart_id = $2
     RETURNING *`,
    [itemId, cartId]
  );

  return result.rows[0];
};

// CLEAR cart
exports.clearCart = async (cartId) => {
  await db.query(
    `DELETE FROM cart_items WHERE cart_id = $1`,
    [cartId]
  );
};

// =========================================
// GET CART FOR CHECKOUT
// =========================================

exports.getCartForCheckout =
async (
  userId,
  client = db
) => {

  const cartResult =
    await client.query(
      `
      SELECT *
      FROM carts
      WHERE user_id = $1
      `,
      [userId]
    );

  const cart =
    cartResult.rows[0];

  if (!cart) {
    throw new Error(
      'Cart not found'
    );
  }

  const items =
    await client.query(
      `
      SELECT 
          ci.id,
          ci.quantity,

          pv.id AS variant_id,
          pv.product_id,
          pv.price,
          pv.quantity AS stock_quantity,
          pv.sku,

          p.name AS product_name,
          p.category_id

      FROM cart_items ci

      JOIN product_variants pv
        ON ci.product_variant_id = pv.id

      JOIN products p
        ON pv.product_id = p.id

      WHERE ci.cart_id = $1

      FOR UPDATE
      `,
      [cart.id]
    );

  return {
    ...cart,
    items: items.rows
  };
};