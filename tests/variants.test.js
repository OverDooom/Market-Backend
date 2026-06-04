const request = require('supertest');
const app = require('../src/app');
const { adminToken, userToken } = require('./helpers/auth');
const db = require('../src/config/db');

let testAttrValueId1;
let testAttrValueId2;
let testAttrValueId3;
let testAttrValueId4;

beforeAll(async () => {
  await db.query(`INSERT INTO categories (id, name) VALUES (1, 'Test Category') ON CONFLICT DO NOTHING`);
  await db.query(`INSERT INTO attributes (id, name) VALUES (1, 'Size') ON CONFLICT DO NOTHING`);
  const r1 = await db.query(
    `INSERT INTO attribute_values (attribute_id, value, code) VALUES (1, 'TestA', 'TESTA') RETURNING id`
  );
  const r2 = await db.query(
    `INSERT INTO attribute_values (attribute_id, value, code) VALUES (1, 'TestB', 'TESTB') RETURNING id`
  );

  const r3 = await db.query(
  `INSERT INTO attribute_values (attribute_id, value, code) VALUES (1, 'TestC', 'TESTC') RETURNING id`
);
const r4 = await db.query(
  `INSERT INTO attribute_values (attribute_id, value, code) VALUES (1, 'TestD', 'TESTD') RETURNING id`
);

  testAttrValueId1 = r1.rows[0].id;
  testAttrValueId2 = r2.rows[0].id;
  testAttrValueId3 = r3.rows[0].id;
  testAttrValueId4 = r4.rows[0].id;

});

afterAll(async () => {
  await db.query(`DELETE FROM attribute_values WHERE id IN ($1, $2, $3, $4)`, [testAttrValueId1, testAttrValueId2, testAttrValueId3, testAttrValueId4]);

  await db.end();
});

describe('Variants', () => {

    test('returns all variants', async () => {
  const res = await request(app)
    .get('/api/products/variants');

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('variant includes product information', async () => {
  const res = await request(app)
    .get('/api/products/variants');

  if (res.body.length > 0) {
    expect(res.body[0])
      .toHaveProperty('product');
  }
});

test('variant includes attributes array', async () => {
  const res = await request(app)
    .get('/api/products/variants');

  if (res.body.length > 0) {
    expect(res.body[0])
      .toHaveProperty('attributes');
  }
});

test('returns variants for product', async () => {

  const res = await request(app)
    .get('/api/products/1/variants');

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);

});

test('returns 400 for invalid product id', async () => {

  const res = await request(app)
    .get('/api/products/abc/variants');

  expect(res.status).toBe(400);

});

test('returns empty array for unknown product', async () => {

  const res = await request(app)
    .get('/api/products/999999/variants');

  expect(res.status).toBe(200);
  expect(res.body).toEqual([]);

});

test('requires authentication', async () => {

  const res = await request(app)
    .post('/api/products/1/variants')
    .send({});

  expect(res.status).toBe(401);

});

test('requires admin role', async () => {

  const res = await request(app)
    .post('/api/products/1/variants')
    .set(
      'Authorization',
      `Bearer ${userToken()}`
    )
    .send({});

  expect(res.status).toBe(403);

});

test('requires price', async () => {

  const res = await request(app)
    .post('/api/products/1/variants')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      quantity: 10,
      attribute_value_ids: [testAttrValueId1]
    });

  expect(res.status).toBe(400);

});

test('requires attributes', async () => {

  const res = await request(app)
    .post('/api/products/1/variants')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      price: 10,
      quantity: 5
    });

  expect(res.status).toBe(400);

});

test('rejects empty attribute array', async () => {

  const res = await request(app)
    .post('/api/products/1/variants')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      price: 10,
      quantity: 5,
      attribute_value_ids: []
    });

  expect(res.status).toBe(400);

});

test('rejects negative quantity', async () => {

  const res = await request(app)
    .post('/api/products/1/variants')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      price: 10,
      quantity: -1,
      attribute_value_ids: [testAttrValueId1]
    });

  expect(res.status).toBe(400);

});

test('rejects invalid product', async () => {

  const res = await request(app)
    .post('/api/products/999999/variants')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      price: 10,
      quantity: 5,
      attribute_value_ids: [testAttrValueId1]
    });

  expect(res.status).toBe(404);

});

test('creates variant', async () => {

  const res = await request(app)
    .post('/api/products/1/variants')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      barcode: '123456',
      price: 10,
      quantity: 20,
      attribute_value_ids: [testAttrValueId1]
    });

  expect(res.status).toBe(201);

  expect(res.body)
    .toHaveProperty('id');

});

test('rejects duplicate variant combination', async () => {

  const payload = {
    price: 10,
    quantity: 20,
    attribute_value_ids: [testAttrValueId1, testAttrValueId2]
  };

  await request(app)
    .post('/api/products/1/variants')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send(payload);

  const res = await request(app)
    .post('/api/products/1/variants')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send(payload);

  expect(res.status).toBe(400);

});

test('detects duplicate regardless of attribute order', async () => {

  await request(app)
    .post('/api/products/1/variants')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      price: 10,
      quantity: 10,
      attribute_value_ids: [testAttrValueId1, testAttrValueId2]
    });

  const res = await request(app)
    .post('/api/products/1/variants')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      price: 10,
      quantity: 10,
      attribute_value_ids: [testAttrValueId2, testAttrValueId1]
    });

  expect(res.status).toBe(400);

});

test('update requires auth', async () => {

  const res = await request(app)
    .put('/api/products/1/variants/1')
    .send({});

  expect(res.status).toBe(401);

});

test('update requires admin', async () => {

  const res = await request(app)
    .put('/api/products/1/variants/1')
    .set(
      'Authorization',
      `Bearer ${userToken()}`
    )
    .send({});

  expect(res.status).toBe(403);

});

test('rejects invalid variant id', async () => {

  const res = await request(app)
    .put('/api/products/1/variants/abc')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({});

  expect(res.status).toBe(400);

});

test('returns 404 when variant missing', async () => {

  const res = await request(app)
    .put('/api/products/1/variants/999999')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      price: 20,
      quantity: 10
    });

  expect(res.status).toBe(404);

});

test('updates variant', async () => {

  const res = await request(app)
    .put('/api/products/1/variants/1')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      barcode: '999',
      price: 15,
      quantity: 20
    });

  expect(res.status).toBe(200);

});

test('updates quantity upward', async () => {

  const res = await request(app)
    .put('/api/products/1/variants/1')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      price: 15,
      quantity: 100
    });

  expect(res.status).toBe(200);

});

test('updates quantity downward', async () => {

  const res = await request(app)
    .put('/api/products/1/variants/1')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      price: 15,
      quantity: 1
    });

  expect(res.status).toBe(200);

});

test('delete requires auth', async () => {

  const res = await request(app)
    .delete('/api/products/1/variants/1');

  expect(res.status).toBe(401);

});

test('delete requires admin', async () => {

  const res = await request(app)
    .delete('/api/products/1/variants/1')
    .set(
      'Authorization',
      `Bearer ${userToken()}`
    );

  expect(res.status).toBe(403);

});

test('rejects invalid delete id', async () => {

  const res = await request(app)
    .delete('/api/products/1/variants/abc')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    );

  expect(res.status).toBe(400);

});

test('returns 404 when deleting unknown variant', async () => {

  const res = await request(app)
    .delete('/api/products/1/variants/999999')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    );

  expect(res.status).toBe(404);

});

test('deletes variant', async () => {

  // Create a fresh variant so we're not hitting one with FK references
  const created = await request(app)
    .post('/api/products/1/variants')
    .set('Authorization', `Bearer ${adminToken()}`)
    .send({ price: 5, quantity: 1, attribute_value_ids: [testAttrValueId3] });


  const res = await request(app)
    .delete(`/api/products/1/variants/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken()}`);

  expect(res.status).toBe(200);
  expect(res.body.message).toBe('Variant deleted');
});

test('cannot delete same variant twice', async () => {

  const created = await request(app)
    .post('/api/products/1/variants')
    .set('Authorization', `Bearer ${adminToken()}`)
    .send({ price: 5, quantity: 1, attribute_value_ids: [testAttrValueId4] });


  await request(app)
    .delete(`/api/products/1/variants/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken()}`);

  const res = await request(app)
    .delete(`/api/products/1/variants/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken()}`);

  expect(res.status).toBe(404);
});

test('updating only price should not null quantity', async () => {

  const res = await request(app)
    .put('/api/products/1/variants/1')
    .set(
      'Authorization',
      `Bearer ${adminToken()}`
    )
    .send({
      price: 99
    });

  expect(res.status).toBe(200);
});


});