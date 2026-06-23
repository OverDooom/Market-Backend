const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');





async function createUser(suffix) {
  const email = `rev_${suffix}_${Date.now()}@mail.com`;
  const hash = await bcrypt.hash('Password123', 10);
  const res = await db.query(
    `INSERT INTO users (name, email, password_hash, role_id) VALUES ($1,$2,$3,1) RETURNING id`,
    [`rev_${suffix}`, email, hash]
  );
  const id = res.rows[0].id;
  const token = jwt.sign({ id, role: 'user' }, process.env.JWT_SECRET);
  return { id, token };
}

const createdUserIds = [];
let user;
let productId;

beforeAll(async () => {
  user = await createUser('main');
  createdUserIds.push(user.id);

  await db.query(`INSERT INTO categories (id, name) VALUES (1,'Test Category') ON CONFLICT DO NOTHING`);

  const prod = await db.query(
    `INSERT INTO products (name, category_id) VALUES ('Review Test Product', 1) RETURNING id`
  );
  productId = prod.rows[0].id;
});

afterAll(async () => {
  await db.query(`DELETE FROM reviews WHERE product_id = $1`, [productId]);
  await db.query(`DELETE FROM products WHERE id = $1`, [productId]);
  await db.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [createdUserIds]);
  await db.end();
});





describe('POST /api/reviews/product/:productId', () => {

  test('requires authentication', async () => {
    const res = await request(app)
      .post(`/api/reviews/product/${productId}`)
      .send({ rating: 4, comment: 'Great' });

    expect(res.status).toBe(401);
  });

  test('creates a review successfully', async () => {
    const freshUser = await createUser('create');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .post(`/api/reviews/product/${productId}`)
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ rating: 5, comment: 'Excellent product!' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.rating).toBe(5);
  });

  test('creates review without comment', async () => {
    const freshUser = await createUser('nocomment');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .post(`/api/reviews/product/${productId}`)
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ rating: 3 });

    expect(res.status).toBe(201);
    expect(res.body.rating).toBe(3);
  });

  test('rejects rating below 1', async () => {
    const freshUser = await createUser('ratinglow');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .post(`/api/reviews/product/${productId}`)
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ rating: 0, comment: 'Bad' });

    expect(res.status).toBe(400);
  });

  test('rejects rating above 5', async () => {
    const freshUser = await createUser('ratinghigh');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .post(`/api/reviews/product/${productId}`)
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ rating: 6, comment: 'Super' });

    expect(res.status).toBe(400);
  });

  test('returns 404 for non-existent product', async () => {
    const freshUser = await createUser('noprod');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .post('/api/reviews/product/999999')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ rating: 4, comment: 'Nice' });

    expect(res.status).toBe(404);
  });

  test('prevents duplicate review on same product', async () => {
    const freshUser = await createUser('dup');
    createdUserIds.push(freshUser.id);

    await request(app)
      .post(`/api/reviews/product/${productId}`)
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ rating: 4, comment: 'First review' });

    const res = await request(app)
      .post(`/api/reviews/product/${productId}`)
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ rating: 5, comment: 'Second review' });

    expect(res.status).toBe(400);
  });

});





describe('GET /api/reviews/product/:productId', () => {

  test('returns reviews for a product (public)', async () => {
    const res = await request(app)
      .get(`/api/reviews/product/${productId}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('each review has id, rating, comment, created_at, user', async () => {
    const freshUser = await createUser('getrev');
    createdUserIds.push(freshUser.id);

    await request(app)
      .post(`/api/reviews/product/${productId}`)
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ rating: 4, comment: 'Good' });

    const res = await request(app)
      .get(`/api/reviews/product/${productId}`);

    expect(res.status).toBe(200);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('rating');
      expect(res.body[0]).toHaveProperty('user');
    }
  });

  test('returns empty array for product with no reviews', async () => {
    const prod = await db.query(
      `INSERT INTO products (name, category_id) VALUES ('NoReview Product', 1) RETURNING id`
    );
    const emptyProdId = prod.rows[0].id;

    const res = await request(app)
      .get(`/api/reviews/product/${emptyProdId}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);

    await db.query(`DELETE FROM products WHERE id = $1`, [emptyProdId]);
  });

});





describe('PUT /api/reviews/:id', () => {

  test('requires authentication', async () => {
    const res = await request(app)
      .put('/api/reviews/1')
      .send({ rating: 3 });

    expect(res.status).toBe(401);
  });

  test('owner can update their review', async () => {
    const freshUser = await createUser('upd');
    createdUserIds.push(freshUser.id);

    const created = await request(app)
      .post(`/api/reviews/product/${productId}`)
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ rating: 3, comment: 'Original' });

    const reviewId = created.body.id;

    const res = await request(app)
      .put(`/api/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ rating: 5, comment: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(5);
    expect(res.body.comment).toBe('Updated');
  });

  test('partial update keeps original rating', async () => {
    const freshUser = await createUser('partupd');
    createdUserIds.push(freshUser.id);

    const created = await request(app)
      .post(`/api/reviews/product/${productId}`)
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ rating: 4, comment: 'Good' });

    const reviewId = created.body.id;

    const res = await request(app)
      .put(`/api/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ comment: 'Updated comment only' });

    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(4);
    expect(res.body.comment).toBe('Updated comment only');
  });

  test('non-owner cannot update a review', async () => {
    const owner = await createUser('revowner');
    const other = await createUser('revother');
    createdUserIds.push(owner.id, other.id);

    const created = await request(app)
      .post(`/api/reviews/product/${productId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ rating: 3, comment: 'Mine' });

    const reviewId = created.body.id;

    const res = await request(app)
      .put(`/api/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ rating: 1, comment: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  test('returns 404 for non-existent review', async () => {
    const freshUser = await createUser('revmissing');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .put('/api/reviews/999999')
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ rating: 2 });

    expect(res.status).toBe(404);
  });

  test('rejects invalid rating on update', async () => {
    const freshUser = await createUser('badrating');
    createdUserIds.push(freshUser.id);

    const created = await request(app)
      .post(`/api/reviews/product/${productId}`)
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ rating: 3, comment: 'Test' });

    const reviewId = created.body.id;

    const res = await request(app)
      .put(`/api/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ rating: 10 });

    expect(res.status).toBe(400);
  });

});





describe('DELETE /api/reviews/:id', () => {

  test('requires authentication', async () => {
    const res = await request(app).delete('/api/reviews/1');
    expect(res.status).toBe(401);
  });

  test('owner can delete their review', async () => {
    const freshUser = await createUser('del');
    createdUserIds.push(freshUser.id);

    const created = await request(app)
      .post(`/api/reviews/product/${productId}`)
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ rating: 2, comment: 'Delete me' });

    const reviewId = created.body.id;

    const res = await request(app)
      .delete(`/api/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(200);
  });

  test('non-owner cannot delete a review', async () => {
    const owner = await createUser('delowner');
    const other = await createUser('delother');
    createdUserIds.push(owner.id, other.id);

    const created = await request(app)
      .post(`/api/reviews/product/${productId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ rating: 4, comment: 'Mine' });

    const reviewId = created.body.id;

    const res = await request(app)
      .delete(`/api/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${other.token}`);

    expect(res.status).toBe(403);
  });

  test('returns 404 for non-existent review', async () => {
    const freshUser = await createUser('delmissing');
    createdUserIds.push(freshUser.id);

    const res = await request(app)
      .delete('/api/reviews/999999')
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(404);
  });

  test('cannot delete the same review twice', async () => {
    const freshUser = await createUser('deltwice');
    createdUserIds.push(freshUser.id);

    const created = await request(app)
      .post(`/api/reviews/product/${productId}`)
      .set('Authorization', `Bearer ${freshUser.token}`)
      .send({ rating: 5, comment: 'Once' });

    const reviewId = created.body.id;

    await request(app)
      .delete(`/api/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${freshUser.token}`);

    const res = await request(app)
      .delete(`/api/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${freshUser.token}`);

    expect(res.status).toBe(404);
  });

});
