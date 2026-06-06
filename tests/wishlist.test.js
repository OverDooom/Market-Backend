const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// =========================================
// HELPERS
// =========================================

async function createUser(suffix) {
  const email = `wl_${suffix}_${Date.now()}@mail.com`;
  const hash = await bcrypt.hash('Password123', 10);
  const res = await db.query(
    `INSERT INTO users (name, email, password_hash, role_id) VALUES ($1,$2,$3,1) RETURNING id`,
    [`wl_${suffix}`, email, hash]
  );
  const id = res.rows[0].id;
  const token = jwt.sign({ id, role: 'user' }, process.env.JWT_SECRET);
  return { id, token };
}

const createdUserIds = [];
let user;
let productId;
let productId2;

beforeAll(async () => {
  user = await createUser('main');
  createdUserIds.push(user.id);

  await db.query(`INSERT INTO categories (id, name) VALUES (1,'Test Category') ON CONFLICT DO NOTHING`);

  const p1 = await db.query(`INSERT INTO products (name, category_id) VALUES ('WL Product 1', 1) RETURNING id`);
  const p2 = await db.query(`INSERT INTO products (name, category_id) VALUES ('WL Product 2', 1) RETURNING id`);
  productId  = p1.rows[0].id;
  productId2 = p2.rows[0].id;
});

afterAll(async () => {
  await db.query(`DELETE FROM wishlist_items WHERE user_id = ANY($1::int[])`, [createdUserIds]);
  await db.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [createdUserIds]);
  await db.query(`DELETE FROM products WHERE id IN ($1,$2)`, [productId, productId2]);
  await db.end();
});

// =========================================
// GET WISHLIST
// =========================================

describe('GET /api/wishlist', () => {

  test('requires authentication', async () => {
    const res = await request(app).get('/api/wishlist');
    expect(res.status).toBe(401);
  });

  test('returns an array', async () => {
    const res = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('returns empty array for fresh user', async () => {
    const freshUser = await createUser('empty');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns items with product info', async () => {
    const freshUser = await createUser('getinfo');
    createdUserIds.push(freshUser.id);

    await request(app)
      .post('/api/wishlist')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ product_id: productId });

    const res = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('product_id');
    expect(res.body[0]).toHaveProperty('product_name');
  });

});

// =========================================
// ADD ITEM
// =========================================

describe('POST /api/wishlist', () => {

  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/wishlist')
      .send({ product_id: productId });

    expect(res.status).toBe(401);
  });

  test('adds a product to wishlist', async () => {
    const freshUser = await createUser('add');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .post('/api/wishlist')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ product_id: productId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.product_id).toBe(productId);
  });

  test('adding same product again is idempotent', async () => {
    const freshUser = await createUser('idem');
    createdUserIds.push(freshUser.id);

    await request(app)
      .post('/api/wishlist')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ product_id: productId });

    const res = await request(app)
      .post('/api/wishlist')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ product_id: productId });

    expect(res.status).toBe(201);
    expect(res.body.already_exists).toBe(true);
  });

  test('returns 400 for missing product_id', async () => {
    const res = await request(app)
      .post('/api/wishlist')
      .set('Authorization', `Bearer ${user.token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('returns 400 for non-numeric product_id', async () => {
    const res = await request(app)
      .post('/api/wishlist')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ product_id: 'abc' });

    expect(res.status).toBe(400);
  });

  test('returns 404 for non-existent product', async () => {
    const res = await request(app)
      .post('/api/wishlist')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ product_id: 999999 });

    expect(res.status).toBe(404);
  });

});

// =========================================
// CHECK ITEM
// =========================================

describe('GET /api/wishlist/:productId/check', () => {

  test('requires authentication', async () => {
    const res = await request(app).get(`/api/wishlist/${productId}/check`);
    expect(res.status).toBe(401);
  });

  test('returns false when product not in wishlist', async () => {
    const freshUser = await createUser('checkfalse');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .get(`/api/wishlist/${productId}/check`)
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body.in_wishlist).toBe(false);
  });

  test('returns true when product is in wishlist', async () => {
    const freshUser = await createUser('checktrue');
    createdUserIds.push(freshUser.id);

    await request(app)
      .post('/api/wishlist')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ product_id: productId });

    const res = await request(app)
      .get(`/api/wishlist/${productId}/check`)
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body.in_wishlist).toBe(true);
    expect(res.body.product_id).toBe(productId);
  });

  test('returns 400 for non-numeric product id', async () => {
    const res = await request(app)
      .get('/api/wishlist/abc/check')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(400);
  });

});

// =========================================
// REMOVE ITEM
// =========================================

describe('DELETE /api/wishlist/:productId', () => {

  test('requires authentication', async () => {
    const res = await request(app).delete(`/api/wishlist/${productId}`);
    expect(res.status).toBe(401);
  });

  test('removes a product from wishlist', async () => {
    const freshUser = await createUser('rem');
    createdUserIds.push(freshUser.id);

    await request(app)
      .post('/api/wishlist')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ product_id: productId });

    const res = await request(app)
      .delete(`/api/wishlist/${productId}`)
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);

    const check = await request(app)
      .get(`/api/wishlist/${productId}/check`)
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(check.body.in_wishlist).toBe(false);
  });

  test('returns 404 when product not in wishlist', async () => {
    const freshUser = await createUser('remnotfound');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .delete(`/api/wishlist/${productId}`)
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(404);
  });

  test('returns 400 for non-numeric product id', async () => {
    const res = await request(app)
      .delete('/api/wishlist/abc')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(400);
  });

});

// =========================================
// CLEAR WISHLIST
// =========================================

describe('DELETE /api/wishlist', () => {

  test('requires authentication', async () => {
    const res = await request(app).delete('/api/wishlist');
    expect(res.status).toBe(401);
  });

  test('clears entire wishlist', async () => {
    const freshUser = await createUser('clear');
    createdUserIds.push(freshUser.id);

    await request(app)
      .post('/api/wishlist')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ product_id: productId });

    await request(app)
      .post('/api/wishlist')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ product_id: productId2 });

    const res = await request(app)
      .delete('/api/wishlist')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Wishlist cleared');

    const wl = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(wl.body).toEqual([]);
  });

  test('clearing an already empty wishlist succeeds', async () => {
    const freshUser = await createUser('clearempty');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .delete('/api/wishlist')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);
  });

});
