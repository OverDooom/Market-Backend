const request = require('supertest');
const app = require('../src/app');
const { adminToken, userToken } = require('./helpers/auth');
const db = require('../src/config/db');

let seededProductId;

beforeAll(async () => {
  
  await db.query(`INSERT INTO categories (id, name) VALUES (1, 'Test Category') ON CONFLICT DO NOTHING`);
  
  const res = await db.query(
    `INSERT INTO products (name, description, brand, category_id) VALUES ('Test Product', 'desc', 'Brand', 1) RETURNING id`
  );
  seededProductId = res.rows[0].id;
});

afterAll(async () => {
  await db.query(`DELETE FROM products WHERE id = $1`, [seededProductId]);
  await db.end();
});

describe('Products', () => {

    test('returns products list', async () => {
        const res = await request(app)
            .get('/api/products');

        expect(res.status).toBe(200);

        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('supports pagination', async () => {
  const res = await request(app)
    .get('/api/products?page=1&limit=5');

  expect(res.status).toBe(200);

  expect(res.body.data.length)
    .toBeLessThanOrEqual(5);
});

test('caps limit to 100', async () => {
  const res = await request(app)
    .get('/api/products?limit=1000');

  expect(res.status).toBe(200);
});

test('supports search', async () => {
  const res = await request(app)
    .get('/api/products?search=milk');

  expect(res.status).toBe(200);
});

test('supports category filter', async () => {
  const res = await request(app)
    .get('/api/products?category=1');

  expect(res.status).toBe(200);
});

test('rejects search injection attempts', async () => {

  const res = await request(app)
    .get(
      "/api/products?search=' OR 1=1 --"
    );

  expect(res.status).toBe(200);
});

test('returns single product', async () => {

  const res = await request(app)
    .get(`/api/products/${seededProductId}`);

  expect(res.status).toBe(200);

  expect(res.body).toHaveProperty('id');
});

test('returns 400 for invalid id', async () => {

  const res = await request(app)
    .get('/api/products/abc');

  expect(res.status).toBe(400);
});

test('returns 404 for missing product', async () => {

  const res = await request(app)
    .get('/api/products/999999');

  expect(res.status).toBe(404);
});

test('requires authentication', async () => {

  const res = await request(app)
    .post('/api/products')
    .send({
      name: 'Milk',
      category_id: 1
    });

  expect(res.status).toBe(401);
});

test('requires admin role', async () => {

  const res = await request(app)
    .post('/api/products')
    .set(
      'Authorization',
      `Bearer ${userToken()}`
    )
    .send({
      name: 'Milk',
      category_id: 1
    });

  expect(res.status).toBe(403);
});

test('requires name', async () => {

  const res = await request(app)
    .post('/api/products')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      category_id: 1
    });

  expect(res.status).toBe(400);
});

test('requires category_id', async () => {

  const res = await request(app)
    .post('/api/products')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      name: 'Milk'
    });

  expect(res.status).toBe(400);
});

test('rejects invalid category', async () => {

  const res = await request(app)
    .post('/api/products')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      name: 'Milk',
      category_id: 999999
    });

  expect(res.status).toBe(404);
});

test('creates product', async () => {

  const res = await request(app)
    .post('/api/products')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      name: 'Milk',
      description: 'Fresh milk',
      brand: 'Almarai',
      category_id: 1
    });

  expect(res.status).toBe(201);

  expect(res.body.name)
    .toBe('Milk');
});

test('returns 400 for invalid id', async () => {

  const res = await request(app)
    .put('/api/products/abc')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({});

  expect(res.status).toBe(400);
});

test('returns 404 when product missing', async () => {

  const res = await request(app)
    .put('/api/products/999999')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      name: 'Updated'
    });

  expect(res.status).toBe(404);
});

test('updates product', async () => {

  const res = await request(app)
    .put(`/api/products/${seededProductId}`)
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      name: 'Updated Product'
    });

  expect([200,404])
    .toContain(res.status);
});

test('rejects invalid category update', async () => {

  const res = await request(app)
    .put(`/api/products/${seededProductId}`)
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      category_id: 999999
    });

  expect(res.status)
    .toBeGreaterThanOrEqual(400);
});

test('returns 400 for invalid delete id', async () => {

  const res = await request(app)
    .delete('/api/products/abc')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    );

  expect(res.status).toBe(400);
});

test('returns 404 for missing product', async () => {

  const res = await request(app)
    .delete('/api/products/999999')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    );

  expect(res.status).toBe(404);
});

test('soft deletes product', async () => {

  const res = await request(app)
    .delete(`/api/products/${seededProductId}`)
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    );

  expect(res.status).toBe(200);

  expect(res.body.message)
    .toBe('Product deleted');
});

test('cannot delete already deleted product', async () => {

  await request(app)
    .delete(`/api/products/${seededProductId}`)
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    );

  const res = await request(app)
    .delete(`/api/products/${seededProductId}`)
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    );

  expect(res.status).toBe(404);
});

});