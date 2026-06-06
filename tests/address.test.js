const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { adminToken } = require('./helpers/auth');
const jwt = require('jsonwebtoken');

// =========================================
// HELPERS
// =========================================

/** Create a real user and return a signed token + user id. */
async function createUser(suffix) {
  const email = `addr_${suffix}_${Date.now()}@mail.com`;
  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash('Password123', 10);

  const res = await db.query(
    `INSERT INTO users (name, email, password_hash, role_id)
     VALUES ($1, $2, $3, 1) RETURNING id`,
    [`addr_${suffix}`, email, hash]
  );
  const id = res.rows[0].id;

  const token = jwt.sign({ id, role: 'user' }, process.env.JWT_SECRET);
  return { id, token, email };
}

const createdUserIds = [];
let user;
let userToken;

beforeAll(async () => {
  user = await createUser('main');
  createdUserIds.push(user.id);
  userToken = user.token;
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.query(`DELETE FROM addresses WHERE user_id = ANY($1::int[])`, [createdUserIds]);
    await db.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [createdUserIds]);
  }
  await db.end();
});

// =========================================
// GET ALL ADDRESSES
// =========================================

describe('GET /api/addresses', () => {

  test('requires authentication', async () => {
    const res = await request(app).get('/api/addresses');
    expect(res.status).toBe(401);
  });

  test('returns array for authenticated user', async () => {
    const res = await request(app)
      .get('/api/addresses')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('only returns addresses belonging to the user', async () => {
    // Create a second user whose addresses should NOT appear
    const other = await createUser('other');
    createdUserIds.push(other.id);

    await db.query(
      `INSERT INTO addresses (user_id, city, street) VALUES ($1, 'OtherCity', 'OtherStreet')`,
      [other.id]
    );

    const res = await request(app)
      .get('/api/addresses')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    const cities = res.body.map(a => a.city);
    expect(cities).not.toContain('OtherCity');
  });

});

// =========================================
// GET SINGLE ADDRESS
// =========================================

describe('GET /api/addresses/:id', () => {

  let addressId;

  beforeAll(async () => {
    const res = await db.query(
      `INSERT INTO addresses (user_id, city, street, building, "Area")
       VALUES ($1, 'Nablus', 'Main St', 'B1', 'Downtown') RETURNING id`,
      [user.id]
    );
    addressId = res.rows[0].id;
  });

  test('requires authentication', async () => {
    const res = await request(app).get(`/api/addresses/${addressId}`);
    expect(res.status).toBe(401);
  });

  test('returns the correct address', async () => {
    const res = await request(app)
      .get(`/api/addresses/${addressId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(addressId);
    expect(res.body.city).toBe('Nablus');
  });

  test('returns 404 for address belonging to another user', async () => {
    const other = await createUser('get404');
    createdUserIds.push(other.id);

    const res = await request(app)
      .get(`/api/addresses/${addressId}`)
      .set('Authorization', `Bearer ${other.token}`);

    expect(res.status).toBe(404);
  });

  test('returns 404 for non-existent address', async () => {
    const res = await request(app)
      .get('/api/addresses/999999')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });

});

// =========================================
// CREATE ADDRESS
// =========================================

describe('POST /api/addresses', () => {

  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/addresses')
      .send({ city: 'Ramallah', street: 'Al-Bireh St' });

    expect(res.status).toBe(401);
  });

  test('creates an address successfully', async () => {
    const res = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ city: 'Ramallah', street: 'Al-Bireh St', building: 'A2', area: 'Center' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.city).toBe('Ramallah');
  });

  test('requires city', async () => {
    const res = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ street: 'Some Street' });

    expect(res.status).toBe(400);
  });

  test('requires street', async () => {
    const res = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ city: 'Hebron' });

    expect(res.status).toBe(400);
  });

  test('building and area are optional', async () => {
    const res = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ city: 'Jenin', street: 'North Rd' });

    expect(res.status).toBe(201);
    expect(res.body.city).toBe('Jenin');
  });

});

// =========================================
// UPDATE ADDRESS
// =========================================

describe('PUT /api/addresses/:id', () => {

  let addressId;

  beforeAll(async () => {
    const res = await db.query(
      `INSERT INTO addresses (user_id, city, street) VALUES ($1, 'OldCity', 'OldStreet') RETURNING id`,
      [user.id]
    );
    addressId = res.rows[0].id;
  });

  test('requires authentication', async () => {
    const res = await request(app)
      .put(`/api/addresses/${addressId}`)
      .send({ city: 'NewCity', street: 'NewStreet' });

    expect(res.status).toBe(401);
  });

  test('updates address successfully', async () => {
    const res = await request(app)
      .put(`/api/addresses/${addressId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ city: 'NewCity', street: 'NewStreet', building: 'C3', area: 'West' });

    expect(res.status).toBe(200);
    expect(res.body.city).toBe('NewCity');
    expect(res.body.street).toBe('NewStreet');
  });

  test('partial update keeps existing values', async () => {
    const res = await request(app)
      .put(`/api/addresses/${addressId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ city: 'PartialCity', street: 'NewStreet' });

    expect(res.status).toBe(200);
    expect(res.body.city).toBe('PartialCity');
  });

  test('returns 404 for address belonging to another user', async () => {
    const other = await createUser('upd404');
    createdUserIds.push(other.id);

    const res = await request(app)
      .put(`/api/addresses/${addressId}`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ city: 'Hack', street: 'Hack St' });

    expect(res.status).toBe(404);
  });

  test('returns 404 for non-existent address', async () => {
    const res = await request(app)
      .put('/api/addresses/999999')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ city: 'X', street: 'Y' });

    expect(res.status).toBe(404);
  });

});

// =========================================
// DELETE ADDRESS
// =========================================

describe('DELETE /api/addresses/:id', () => {

  test('requires authentication', async () => {
    const addr = await db.query(
      `INSERT INTO addresses (user_id, city, street) VALUES ($1, 'TmpCity', 'TmpSt') RETURNING id`,
      [user.id]
    );

    const res = await request(app)
      .delete(`/api/addresses/${addr.rows[0].id}`);

    expect(res.status).toBe(401);

    // cleanup
    await db.query(`DELETE FROM addresses WHERE id = $1`, [addr.rows[0].id]);
  });

  test('deletes address successfully', async () => {
    const addr = await db.query(
      `INSERT INTO addresses (user_id, city, street) VALUES ($1, 'DeleteCity', 'DeleteSt') RETURNING id`,
      [user.id]
    );
    const id = addr.rows[0].id;

    const res = await request(app)
      .delete(`/api/addresses/${id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  test('returns 404 for address belonging to another user', async () => {
    const other = await createUser('del404');
    createdUserIds.push(other.id);

    const addr = await db.query(
      `INSERT INTO addresses (user_id, city, street) VALUES ($1, 'SomeCity', 'SomeSt') RETURNING id`,
      [user.id]
    );
    const id = addr.rows[0].id;

    const res = await request(app)
      .delete(`/api/addresses/${id}`)
      .set('Authorization', `Bearer ${other.token}`);

    expect(res.status).toBe(404);

    // cleanup
    await db.query(`DELETE FROM addresses WHERE id = $1`, [id]);
  });

  test('returns 404 for non-existent address', async () => {
    const res = await request(app)
      .delete('/api/addresses/999999')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });

  test('cannot delete same address twice', async () => {
    const addr = await db.query(
      `INSERT INTO addresses (user_id, city, street) VALUES ($1, 'Once', 'OnlySt') RETURNING id`,
      [user.id]
    );
    const id = addr.rows[0].id;

    await request(app)
      .delete(`/api/addresses/${id}`)
      .set('Authorization', `Bearer ${userToken}`);

    const res = await request(app)
      .delete(`/api/addresses/${id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });

});
