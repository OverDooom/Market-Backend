const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// =========================================
// HELPERS
// =========================================

async function createUser(suffix) {
  const email = `cart_${suffix}_${Date.now()}@mail.com`;
  const hash = await bcrypt.hash('Password123', 10);
  const res = await db.query(
    `INSERT INTO users (name, email, password_hash, role_id) VALUES ($1,$2,$3,1) RETURNING id`,
    [`cart_${suffix}`, email, hash]
  );
  const id = res.rows[0].id;
  const token = jwt.sign({ id, role: 'user' }, process.env.JWT_SECRET);
  return { id, token };
}

const createdUserIds = [];
let user;
let variantId;
let variantId2;

beforeAll(async () => {
  user = await createUser('main');
  createdUserIds.push(user.id);

  // Ensure base data exists
  await db.query(`INSERT INTO categories (id, name) VALUES (1,'Test Category') ON CONFLICT DO NOTHING`);
  await db.query(`INSERT INTO attributes (id, name) VALUES (1,'Size') ON CONFLICT DO NOTHING`);

  // Create a product and two variants to use in cart tests
  const prod = await db.query(
    `INSERT INTO products (name, category_id) VALUES ('Cart Test Product', 1) RETURNING id`
  );
  const productId = prod.rows[0].id;

  const av1 = await db.query(
    `INSERT INTO attribute_values (attribute_id, value, code) VALUES (1,'CartXL','CRTXL') RETURNING id`
  );
  const av2 = await db.query(
    `INSERT INTO attribute_values (attribute_id, value, code) VALUES (1,'CartSM','CRTSM') RETURNING id`
  );

  const v1 = await db.query(
    `INSERT INTO product_variants (product_id, price, quantity, sku) VALUES ($1, 25.00, 50, 'CART-V1') RETURNING id`,
    [productId]
  );
  const v2 = await db.query(
    `INSERT INTO product_variants (product_id, price, quantity, sku) VALUES ($1, 15.00, 30, 'CART-V2') RETURNING id`,
    [productId]
  );

  await db.query(`INSERT INTO variant_attributes (variant_id, attribute_value_id) VALUES ($1,$2)`, [v1.rows[0].id, av1.rows[0].id]);
  await db.query(`INSERT INTO variant_attributes (variant_id, attribute_value_id) VALUES ($1,$2)`, [v2.rows[0].id, av2.rows[0].id]);

  variantId  = v1.rows[0].id;
  variantId2 = v2.rows[0].id;
});

afterAll(async () => {
  // Clean up carts, then users, then variants/products/attribute_values
  await db.query(`DELETE FROM cart_items USING carts WHERE cart_items.cart_id = carts.id AND carts.user_id = ANY($1::int[])`, [createdUserIds]);
  await db.query(`DELETE FROM carts WHERE user_id = ANY($1::int[])`, [createdUserIds]);
  await db.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [createdUserIds]);
  await db.query(`DELETE FROM variant_attributes WHERE variant_id IN ($1,$2)`, [variantId, variantId2]);
  await db.query(`DELETE FROM product_variants WHERE id IN ($1,$2)`, [variantId, variantId2]);
  await db.query(`DELETE FROM attribute_values WHERE code IN ('CRTXL','CRTSM')`);
  await db.query(`DELETE FROM products WHERE name = 'Cart Test Product'`);
  await db.end();
});

// =========================================
// GET CART
// =========================================

describe('GET /api/cart', () => {

  test('requires authentication', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(401);
  });

  test('returns cart object with items array', async () => {
    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cart');
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test('auto-creates cart on first access', async () => {
    const freshUser = await createUser('fresh');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body.cart).toHaveProperty('id');
  });

});

// =========================================
// ADD ITEM
// =========================================

describe('POST /api/cart/items', () => {

  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .send({ variant_id: variantId, quantity: 1 });

    expect(res.status).toBe(401);
  });

  test('adds item to cart', async () => {
    const freshUser = await createUser('add');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ variant_id: variantId, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.quantity).toBe(2);
  });

  test('increments quantity when same variant added again', async () => {
    const freshUser = await createUser('increment');
    createdUserIds.push(freshUser.id);

    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ variant_id: variantId, quantity: 1 });

    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ variant_id: variantId, quantity: 3 });

    expect(res.status).toBe(201);
    expect(res.body.quantity).toBe(4);
  });

  test('can add multiple different variants', async () => {
    const freshUser = await createUser('multi');
    createdUserIds.push(freshUser.id);

    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ variant_id: variantId, quantity: 1 });

    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ variant_id: variantId2, quantity: 2 });

    expect(res.status).toBe(201);

    const cart = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(cart.body.items.length).toBe(2);
  });

});

// =========================================
// REMOVE ITEM
// =========================================

describe('DELETE /api/cart/items/:itemId', () => {

  test('requires authentication', async () => {
    const res = await request(app).delete('/api/cart/items/1');
    expect(res.status).toBe(401);
  });

  test('removes an item from the cart', async () => {
    const freshUser = await createUser('remove');
    createdUserIds.push(freshUser.id);

    const added = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ variant_id: variantId, quantity: 1 });

    const itemId = added.body.id;

    const res = await request(app)
      .delete(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);

    const cart = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(cart.body.items.length).toBe(0);
  });

});

// =========================================
// CLEAR CART
// =========================================

describe('DELETE /api/cart', () => {

  test('requires authentication', async () => {
    const res = await request(app).delete('/api/cart');
    expect(res.status).toBe(401);
  });

  test('clears all items from cart', async () => {
    const freshUser = await createUser('clear');
    createdUserIds.push(freshUser.id);

    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ variant_id: variantId, quantity: 1 });

    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ variant_id: variantId2, quantity: 2 });

    const res = await request(app)
      .delete('/api/cart')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Cart cleared');

    const cart = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(cart.body.items.length).toBe(0);
  });

  test('clearing an already empty cart succeeds', async () => {
    const freshUser = await createUser('clearempty');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .delete('/api/cart')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);
  });

});
