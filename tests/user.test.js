const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');





async function createUser(suffix) {
  const email = `user_${suffix}_${Date.now()}@mail.com`;
  const hash = await bcrypt.hash('Password123', 10);

  const res = await db.query(
    `INSERT INTO users (name, email, password_hash, role_id)
     VALUES ($1, $2, $3, 1) RETURNING id, name, email, phone`,
    [`User_${suffix}`, email, hash]
  );

  const user = res.rows[0];
  const token = jwt.sign({ id: user.id, role: 'user' }, process.env.JWT_SECRET);
  return { ...user, token, password: 'Password123' };
}

const createdUserIds = [];

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [createdUserIds]);
  }
  await db.end();
});





describe('GET /api/user/me', () => {

  test('requires authentication', async () => {
    const res = await request(app).get('/api/user/me');
    expect(res.status).toBe(401);
  });

  test('returns profile for authenticated user', async () => {
    const user = await createUser('profile');
    createdUserIds.push(user.id);

    const res = await request(app)
      .get('/api/user/me')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.email).toBe(user.email);
  });

  test('does not expose password_hash', async () => {
    const user = await createUser('nohash');
    createdUserIds.push(user.id);

    const res = await request(app)
      .get('/api/user/me')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('password_hash');
  });

  test('returns id, name, email, phone fields', async () => {
    const user = await createUser('fields');
    createdUserIds.push(user.id);

    const res = await request(app)
      .get('/api/user/me')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('email');
    expect(res.body).toHaveProperty('phone');
  });

  test('rejects expired / invalid token', async () => {
    const badToken = jwt.sign({ id: 999, role: 'user' }, 'wrong-secret');

    const res = await request(app)
      .get('/api/user/me')
      .set('Authorization', `Bearer ${badToken}`);

    expect(res.status).toBe(401);
  });

});





describe('PUT /api/user/me', () => {

  test('requires authentication', async () => {
    const res = await request(app)
      .put('/api/user/me')
      .send({ name: 'New Name' });

    expect(res.status).toBe(401);
  });

  test('updates name successfully', async () => {
    const user = await createUser('updname');
    createdUserIds.push(user.id);

    const res = await request(app)
      .put('/api/user/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
  });

  test('updates phone successfully', async () => {
    const user = await createUser('updphone');
    createdUserIds.push(user.id);

    const res = await request(app)
      .put('/api/user/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ phone: '+970591234567' });

    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('+970591234567');
  });

  test('partial update keeps existing name', async () => {
    const user = await createUser('partial');
    createdUserIds.push(user.id);

    
    await request(app)
      .put('/api/user/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'OriginalName' });

    
    const res = await request(app)
      .put('/api/user/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ phone: '0599000000' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('OriginalName');
    expect(res.body.phone).toBe('0599000000');
  });

  test('response does not expose password_hash', async () => {
    const user = await createUser('nohash2');
    createdUserIds.push(user.id);

    const res = await request(app)
      .put('/api/user/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Safe' });

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('password_hash');
  });

  test('returns id, name, email, phone', async () => {
    const user = await createUser('retfields');
    createdUserIds.push(user.id);

    const res = await request(app)
      .put('/api/user/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'FieldsUser' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('email');
    expect(res.body).toHaveProperty('phone');
  });

});
