const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { adminToken } = require('./helpers/auth');





async function createUser(suffix) {
  const email = `notif_${suffix}_${Date.now()}@mail.com`;
  const hash = await bcrypt.hash('Password123', 10);
  const res = await db.query(
    `INSERT INTO users (name, email, password_hash, role_id) VALUES ($1,$2,$3,1) RETURNING id`,
    [`notif_${suffix}`, email, hash]
  );
  const id = res.rows[0].id;
  const token = jwt.sign({ id, role: 'user' }, process.env.JWT_SECRET);
  return { id, token };
}

async function seedNotification(userId, title = 'Test Notification') {
  const notifRes = await db.query(
    `INSERT INTO notifications (title, message, type) VALUES ($1, 'Test message', 'info') RETURNING id`,
    [title]
  );
  const notifId = notifRes.rows[0].id;

  await db.query(
    `INSERT INTO user_notifications (user_id, notification_id) VALUES ($1, $2)`,
    [userId, notifId]
  );

  const unRes = await db.query(
    `SELECT id FROM user_notifications WHERE user_id = $1 AND notification_id = $2`,
    [userId, notifId]
  );

  return { notifId, userNotifId: unRes.rows[0].id };
}

const createdUserIds = [];
let user;

beforeAll(async () => {
  user = await createUser('main');
  createdUserIds.push(user.id);
});

afterAll(async () => {
  await db.query(`DELETE FROM user_notifications WHERE user_id = ANY($1::int[])`, [createdUserIds]);
  await db.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [createdUserIds]);
  await db.end();
});





describe('GET /api/notifications', () => {

  test('requires authentication', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  test('returns an array', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('returns only the user\'s notifications', async () => {
    const freshUser = await createUser('mine');
    createdUserIds.push(freshUser.id);

    await seedNotification(freshUser.id, 'Only Mine');

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('title');
    expect(res.body[0]).toHaveProperty('is_read');
  });

  test('is_read defaults to false', async () => {
    const freshUser = await createUser('unread');
    createdUserIds.push(freshUser.id);

    await seedNotification(freshUser.id, 'Unread One');

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body[0].is_read).toBe(false);
  });

});





describe('PUT /api/notifications/:id/read', () => {

  test('requires authentication', async () => {
    const res = await request(app).put('/api/notifications/1/read');
    expect(res.status).toBe(401);
  });

  test('marks a notification as read', async () => {
    const freshUser = await createUser('markread');
    createdUserIds.push(freshUser.id);

    const { userNotifId } = await seedNotification(freshUser.id, 'To be read');

    const res = await request(app)
      .put(`/api/notifications/${userNotifId}/read`)
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body.is_read).toBe(true);
  });

  test('returns 404 for notification not belonging to user', async () => {
    const owner = await createUser('notifowner');
    const other = await createUser('notifother');
    createdUserIds.push(owner.id, other.id);

    const { userNotifId } = await seedNotification(owner.id, 'Owner Notif');

    const res = await request(app)
      .put(`/api/notifications/${userNotifId}/read`)
      .set('Authorization', `Bearer ${other.token}`);

    expect(res.status).toBe(404);
  });

  test('returns 404 for non-existent user_notification id', async () => {
    const res = await request(app)
      .put('/api/notifications/999999/read')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(404);
  });

});





describe('PUT /api/notifications/read-all', () => {

  test('requires authentication', async () => {
    const res = await request(app).put('/api/notifications/read-all');
    expect(res.status).toBe(401);
  });

  test('marks all notifications as read', async () => {
    const freshUser = await createUser('allread');
    createdUserIds.push(freshUser.id);

    await seedNotification(freshUser.id, 'Unread A');
    await seedNotification(freshUser.id, 'Unread B');

    const res = await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');

    const check = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${freshUser.token}`);

    const allRead = check.body.every(n => n.is_read === true);
    expect(allRead).toBe(true);
  });

  test('succeeds even when there are no notifications', async () => {
    const freshUser = await createUser('readnone');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);
  });

});





describe('POST /api/notifications (admin)', () => {

  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .send({ title: 'Hi', message: 'World', type: 'info', user_ids: [] });

    expect(res.status).toBe(401);
  });

  test('non-admin gets 403', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Hi', message: 'World', type: 'info', user_ids: [] });

    expect(res.status).toBe(403);
  });

  test('admin can create a notification', async () => {
    const freshUser = await createUser('notifrecip');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        title: 'Admin Notif',
        message: 'Hello from admin',
        type: 'info',
        userIds: [freshUser.id],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

});
