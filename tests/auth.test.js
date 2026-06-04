const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');

// Track every user created so we can clean up after all tests
const createdUserIds = [];

async function registerAndLogin(suffix) {
  const email = `${suffix}_${Date.now()}@mail.com`;
  const password = 'Password123';

  const reg = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email, password });

  if (reg.body.id) createdUserIds.push(reg.body.id);

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  // Fail loudly so a rate-limit or unexpected error surfaces here,
  // not as a confusing 400/401 several lines later in the real test.

  
  if (login.status !== 200) {
    throw new Error(
      `registerAndLogin("${suffix}") — login failed with ${login.status}: ` +
      JSON.stringify(login.body)
    );
  }

  return { email, password, ...login.body };
}

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.query(
      `DELETE FROM refresh_tokens WHERE user_id = ANY($1::int[])`,
      [createdUserIds]
    );
    await db.query(
      `DELETE FROM users WHERE id = ANY($1::int[])`,
      [createdUserIds]
    );
  }
  await db.end();
});

// =========================================
// REGISTER
// =========================================

describe('Register', () => {

  test('registers a new user', async () => {
    const email = `reg_new_${Date.now()}@mail.com`;

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email, password: 'Password123' });

    if (res.body.id) createdUserIds.push(res.body.id);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('email');
  });

  test('requires email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', password: 'Password123' });

    expect(res.status).toBe(400);
  });

  test('requires password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'test@mail.com' });

    expect(res.status).toBe(400);
  });

  test('rejects duplicate email', async () => {
    const email = `dup_${Date.now()}@mail.com`;

    const first = await request(app)
      .post('/api/auth/register')
      .send({ name: 'User1', email, password: 'Password123' });

    if (first.body.id) createdUserIds.push(first.body.id);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'User2', email, password: 'Password123' });

    expect(res.status).toBe(400);
  });

  test('rejects empty body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({});

    expect(res.status).toBe(400);
  });

});

// =========================================
// LOGIN
// =========================================

describe('Login', () => {

  test('succeeds with valid credentials', async () => {
    const session = await registerAndLogin('login_ok');

    expect(session).toHaveProperty('access_token');
    expect(session).toHaveProperty('refresh_token');
  });

  test('rejects unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'doesnotexist@mail.com', password: 'Password123' });

    expect(res.status).toBe(401);
  });

  test('rejects wrong password', async () => {
    const email = `wrongpass_${Date.now()}@mail.com`;

    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'User', email, password: 'CorrectPassword' });

    if (reg.body.id) createdUserIds.push(reg.body.id);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'WrongPassword' });

    expect(res.status).toBe(401);
  });

  test('requires email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'Password123' });

    expect(res.status).toBe(400);
  });

  test('requires password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@mail.com' });

    expect(res.status).toBe(400);
  });

  test('rejects empty body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
  });

});

// =========================================
// REFRESH TOKEN
// =========================================

describe('Refresh Token', () => {

  test('refreshes token successfully', async () => {
    const session = await registerAndLogin('refresh_ok');

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: session.refresh_token });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
  });

  test('requires token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({});

    expect(res.status).toBe(401);
  });

  test('rejects invalid token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: 'invalid-token' });

    expect(res.status).toBe(401);
  });

  test('old token cannot be reused after rotation', async () => {
    const session = await registerAndLogin('rotate');
    const oldToken = session.refresh_token;

    const first = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: oldToken });

    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: oldToken });

    expect(second.status).toBe(401);
  });

  test('replayed token invalidates entire family', async () => {
    const session = await registerAndLogin('family_invalidate');
    const oldToken = session.refresh_token;

    // Rotate once
    const rotated = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: oldToken });

    expect(rotated.status).toBe(200);

    // Replay the old token — should revoke the whole family
    await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: oldToken });

    // The new token from rotation should now also be invalid
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: rotated.body.refresh_token });

    expect(res.status).toBe(401);
  });

});

// =========================================
// LOGOUT
// =========================================

describe('Logout', () => {

  test('logout succeeds', async () => {
    const session = await registerAndLogin('logout_ok');

    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refresh_token: session.refresh_token });

    expect(res.status).toBe(200);
  });

  test('requires refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .send({});

    expect(res.status).toBe(400);
  });

  test('logged out token cannot be reused', async () => {
    const session = await registerAndLogin('logout_reuse');

    await request(app)
      .post('/api/auth/logout')
      .send({ refresh_token: session.refresh_token });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: session.refresh_token });

    expect(res.status).toBe(401);
  });

});

// =========================================
// LOGOUT ALL
// =========================================

describe('Logout All', () => {

  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/auth/logout-all');

    expect(res.status).toBe(401);
  });

  test('revokes all sessions', async () => {
    const session = await registerAndLogin('logout_all');

    const res = await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${session.access_token}`);

    expect(res.status).toBe(200);
  });

  test('all refresh tokens invalid after logout-all', async () => {
    const session = await registerAndLogin('logout_all_verify');

    // Get a second token by logging in again
    const login2 = await request(app)
      .post('/api/auth/login')
      .send({ email: session.email, password: 'Password123' });

    // Logout all using the first access token
    await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${session.access_token}`);

    // Both refresh tokens should now be revoked
    const r1 = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: session.refresh_token });

    const r2 = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: login2.body.refresh_token });

    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
  });

});
