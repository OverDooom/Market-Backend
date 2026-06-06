const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { adminToken, userToken } = require('./helpers/auth');

// =========================================
// HELPERS
// =========================================

async function createUser(suffix) {
  const email = `adm_${suffix}_${Date.now()}@mail.com`;
  const hash = await bcrypt.hash('Password123', 10);
  const res = await db.query(
    `INSERT INTO users (name, email, password_hash, role_id) VALUES ($1,$2,$3,1) RETURNING id`,
    [`adm_${suffix}`, email, hash]
  );
  const id = res.rows[0].id;
  const token = jwt.sign({ id, role: 'user' }, process.env.JWT_SECRET);
  return { id, token, email };
}

const createdUserIds = [];

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [createdUserIds]);
  }
  await db.end();
});

// =========================================
// AUTH GUARD — every admin route must reject non-admin
// =========================================

describe('Admin route guards', () => {

  const guardRoutes = [
    ['GET',    '/api/admin/dashboard'],
    ['GET',    '/api/admin/users'],
    ['GET',    '/api/admin/orders'],
    ['GET',    '/api/admin/reviews'],
    ['GET',    '/api/admin/notifications'],
    ['GET',    '/api/admin/wishlist/stats'],
    ['GET',    '/api/admin/promotions'],
  ];

  for (const [method, path] of guardRoutes) {
    test(`${method} ${path} — rejects unauthenticated`, async () => {
      const res = await request(app)[method.toLowerCase()](path);
      expect(res.status).toBe(401);
    });

    test(`${method} ${path} — rejects non-admin`, async () => {
      const res = await request(app)[method.toLowerCase()](path)
        .set('Authorization', `Bearer ${userToken()}`);
      expect(res.status).toBe(403);
    });
  }

});

// =========================================
// DASHBOARD
// =========================================

describe('GET /api/admin/dashboard', () => {

  test('returns dashboard stats', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
    expect(res.body).toHaveProperty('orders');
    expect(res.body).toHaveProperty('revenue');
    expect(res.body).toHaveProperty('top_products');
    expect(res.body).toHaveProperty('recent_orders');
    expect(res.body).toHaveProperty('low_stock');
  });

});

// =========================================
// USERS
// =========================================

describe('GET /api/admin/users', () => {

  test('returns array of users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('supports search query param', async () => {
    const res = await request(app)
      .get('/api/admin/users?search=test')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
  });

  test('supports role filter', async () => {
    const res = await request(app)
      .get('/api/admin/users?role=user')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
  });

  test('supports pagination', async () => {
    const res = await request(app)
      .get('/api/admin/users?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(5);
  });

});

describe('GET /api/admin/users/:id', () => {

  test('returns user by id', async () => {
    const user = await createUser('get');
    createdUserIds.push(user.id);

    const res = await request(app)
      .get(`/api/admin/users/${user.id}`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
  });

  test('returns 404 for unknown user', async () => {
    const res = await request(app)
      .get('/api/admin/users/999999')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(404);
  });

});

describe('PUT /api/admin/users/:id', () => {

  test('admin can update user name', async () => {
    const user = await createUser('upd');
    createdUserIds.push(user.id);

    const res = await request(app)
      .put(`/api/admin/users/${user.id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'UpdatedByAdmin' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('UpdatedByAdmin');
  });

  test('returns 404 for unknown user', async () => {
    const res = await request(app)
      .put('/api/admin/users/999999')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'X' });

    expect(res.status).toBe(404);
  });

  test('rejects duplicate email', async () => {
    const u1 = await createUser('dup1');
    const u2 = await createUser('dup2');
    createdUserIds.push(u1.id, u2.id);

    const res = await request(app)
      .put(`/api/admin/users/${u2.id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ email: u1.email });

    expect(res.status).toBe(400);
  });

  test('rejects unknown role', async () => {
    const user = await createUser('badrole');
    createdUserIds.push(user.id);

    const res = await request(app)
      .put(`/api/admin/users/${user.id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ role: 'superuser' });

    expect(res.status).toBe(400);
  });

});

describe('DELETE /api/admin/users/:id', () => {

  test('returns 404 for unknown user', async () => {
    const res = await request(app)
      .delete('/api/admin/users/999999')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(404);
  });

  test('admin can delete a user with no relations', async () => {
    const user = await createUser('del');
    // NOT added to createdUserIds — the test deletes it

    const res = await request(app)
      .delete(`/api/admin/users/${user.id}`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
  });

});

describe('GET /api/admin/users/:id/orders', () => {

  test('returns orders for user', async () => {
    const user = await createUser('orders');
    createdUserIds.push(user.id);

    const res = await request(app)
      .get(`/api/admin/users/${user.id}/orders`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('returns 404 for unknown user', async () => {
    const res = await request(app)
      .get('/api/admin/users/999999/orders')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(404);
  });

});

describe('GET /api/admin/users/:id/reviews', () => {

  test('returns reviews for user', async () => {
    const user = await createUser('reviews');
    createdUserIds.push(user.id);

    const res = await request(app)
      .get(`/api/admin/users/${user.id}/reviews`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

});

describe('GET /api/admin/users/:id/wishlist', () => {

  test('returns wishlist for user', async () => {
    const user = await createUser('wishlist');
    createdUserIds.push(user.id);

    const res = await request(app)
      .get(`/api/admin/users/${user.id}/wishlist`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

});

// =========================================
// ORDERS
// =========================================

describe('GET /api/admin/orders', () => {

  test('returns array of orders', async () => {
    const res = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('supports status filter', async () => {
    const res = await request(app)
      .get('/api/admin/orders?status=pending')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
  });

  test('supports pagination', async () => {
    const res = await request(app)
      .get('/api/admin/orders?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(5);
  });

});

describe('GET /api/admin/orders/:id', () => {

  test('returns 404 for non-existent order', async () => {
    const res = await request(app)
      .get('/api/admin/orders/999999')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(404);
  });

});

// =========================================
// REVIEWS
// =========================================

describe('GET /api/admin/reviews', () => {

  test('returns array of reviews', async () => {
    const res = await request(app)
      .get('/api/admin/reviews')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('supports rating filter', async () => {
    const res = await request(app)
      .get('/api/admin/reviews?rating=5')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
  });

  test('supports product_id filter', async () => {
    const res = await request(app)
      .get('/api/admin/reviews?product_id=1')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
  });

});

describe('DELETE /api/admin/reviews/:id', () => {

  test('returns 404 for non-existent review', async () => {
    const res = await request(app)
      .delete('/api/admin/reviews/999999')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(404);
  });

});

// =========================================
// NOTIFICATIONS
// =========================================

describe('GET /api/admin/notifications', () => {

  test('returns array of notifications', async () => {
    const res = await request(app)
      .get('/api/admin/notifications')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

});

describe('POST /api/admin/notifications', () => {

  test('sends notification to specific users', async () => {
    const user = await createUser('notif_recip');
    createdUserIds.push(user.id);

    const res = await request(app)
      .post('/api/admin/notifications')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        title:    'Test',
        message:  'Hello',
        user_ids: [user.id],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  test('requires title and message', async () => {
    const user = await createUser('notif_nodata');
    createdUserIds.push(user.id);

    const res = await request(app)
      .post('/api/admin/notifications')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ user_ids: [user.id] });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('requires at least one recipient or broadcast_all', async () => {
    const res = await request(app)
      .post('/api/admin/notifications')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ title: 'No recipient', message: 'Oops', user_ids: [] });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

});

describe('DELETE /api/admin/notifications/:id', () => {

  test('returns 404 for non-existent notification', async () => {
    const res = await request(app)
      .delete('/api/admin/notifications/999999')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(404);
  });

  test('admin can delete a notification', async () => {
    const user = await createUser('notif_del');
    createdUserIds.push(user.id);

    const created = await request(app)
      .post('/api/admin/notifications')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ title: 'Del', message: 'DeleteMe', user_ids: [user.id] });

    const notifId = created.body.id;

    const res = await request(app)
      .delete(`/api/admin/notifications/${notifId}`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
  });

});

// =========================================
// WISHLIST STATS
// =========================================

describe('GET /api/admin/wishlist/stats', () => {

  test('returns an array', async () => {
    const res = await request(app)
      .get('/api/admin/wishlist/stats')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('respects limit param', async () => {
    const res = await request(app)
      .get('/api/admin/wishlist/stats?limit=3')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(3);
  });

});

// =========================================
// PROMOTIONS
// =========================================

describe('Admin Promotions', () => {

  let promoId;

  test('GET /api/admin/promotions returns array', async () => {
    const res = await request(app)
      .get('/api/admin/promotions')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/admin/promotions creates promotion', async () => {
    const res = await request(app)
      .post('/api/admin/promotions')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        name:  'Test Promo',
        type:  'percentage',
        value: 10,
        is_automatic: false,
        coupon_required: true,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test Promo');
    promoId = res.body.id;
  });

  test('POST /api/admin/promotions requires name, type, value', async () => {
    const res = await request(app)
      .post('/api/admin/promotions')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ type: 'percentage' });

    expect(res.status).toBe(400);
  });

  test('POST /api/admin/promotions rejects bad type', async () => {
    const res = await request(app)
      .post('/api/admin/promotions')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'X', type: 'bogus', value: 5 });

    expect(res.status).toBe(400);
  });

  test('POST /api/admin/promotions rejects percentage > 100', async () => {
    const res = await request(app)
      .post('/api/admin/promotions')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'X', type: 'percentage', value: 150 });

    expect(res.status).toBe(400);
  });

  test('GET /api/admin/promotions/:id returns promotion', async () => {
    const res = await request(app)
      .get(`/api/admin/promotions/${promoId}`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(promoId);
    expect(res.body).toHaveProperty('coupons');
  });

  test('GET /api/admin/promotions/:id 404 for unknown', async () => {
    const res = await request(app)
      .get('/api/admin/promotions/999999')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(404);
  });

  test('PUT /api/admin/promotions/:id updates promotion', async () => {
    const res = await request(app)
      .put(`/api/admin/promotions/${promoId}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Updated Promo', type: 'percentage', value: 15 });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Promo');
  });

  test('PATCH /api/admin/promotions/:id/toggle flips is_active', async () => {
    const before = await request(app)
      .get(`/api/admin/promotions/${promoId}`)
      .set('Authorization', `Bearer ${adminToken()}`);

    const wasActive = before.body.is_active;

    const res = await request(app)
      .patch(`/api/admin/promotions/${promoId}/toggle`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.is_active).toBe(!wasActive);
  });

  test('GET /api/admin/promotions/:id/usage returns stats', async () => {
    const res = await request(app)
      .get(`/api/admin/promotions/${promoId}/usage`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('usage');
  });

  // --- Coupons ---

  let couponId;

  test('POST /api/admin/promotions/:id/coupons adds coupons', async () => {
    const res = await request(app)
      .post(`/api/admin/promotions/${promoId}/coupons`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ coupons: [{ code: `TESTCOUPON_${Date.now()}`, usage_limit: 10 }] });

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('id');
    couponId = res.body[0].id;
  });

  test('POST coupons rejects empty array', async () => {
    const res = await request(app)
      .post(`/api/admin/promotions/${promoId}/coupons`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ coupons: [] });

    expect(res.status).toBe(400);
  });

  test('PATCH /api/admin/promotions/:id/coupons/:couponId/toggle flips coupon', async () => {
    const res = await request(app)
      .patch(`/api/admin/promotions/${promoId}/coupons/${couponId}/toggle`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
  });

  test('DELETE /api/admin/promotions/:id/coupons/:couponId deletes coupon', async () => {
    const res = await request(app)
      .delete(`/api/admin/promotions/${promoId}/coupons/${couponId}`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
  });

  test('DELETE /api/admin/promotions/:id deletes promotion without usage', async () => {
    const res = await request(app)
      .delete(`/api/admin/promotions/${promoId}`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
  });

  test('DELETE returns 404 for already deleted promotion', async () => {
    const res = await request(app)
      .delete(`/api/admin/promotions/${promoId}`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(404);
  });

});
