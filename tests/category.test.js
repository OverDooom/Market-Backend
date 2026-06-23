const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { adminToken, userToken } = require('./helpers/auth');



const createdIds = [];

let parentCategory;
let childCategory;

beforeAll(async () => {
  
  await db.query(`
    DELETE FROM categories
    WHERE name IN (
      'TEST_PARENT_CATEGORY',
      'TEST_CHILD_CATEGORY',
      'TEST_UPDATE_CATEGORY'
    )
  `);

  const parent = await db.query(`
    INSERT INTO categories (name)
    VALUES ('TEST_PARENT_CATEGORY')
    RETURNING *
  `);
  parentCategory = parent.rows[0];
  createdIds.push(parentCategory.id);

  const child = await db.query(`
    INSERT INTO categories (name, parent_id)
    VALUES ('TEST_CHILD_CATEGORY', $1)
    RETURNING *
  `, [parentCategory.id]);
  childCategory = child.rows[0];
  createdIds.push(childCategory.id);
});

afterAll(async () => {
  
  
  
  const sorted = [...createdIds].sort((a, b) => b - a);

  for (const id of sorted) {
    await db.query(
      `DELETE FROM categories WHERE id = $1`,
      [id]
    ).catch(() => {
      
    });
  }
});





describe('GET /api/categories', () => {

  test('returns an array', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('each item has id, name, parent_id fields', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('parent_id');
    }
  });

});





describe('GET /api/categories/:id', () => {

  test('returns the correct category', async () => {
    const res = await request(app)
      .get(`/api/categories/${parentCategory.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(parentCategory.id);
    expect(res.body.name).toBe('TEST_PARENT_CATEGORY');
  });

  test('child category has correct parent_id', async () => {
    const res = await request(app)
      .get(`/api/categories/${childCategory.id}`);

    expect(res.status).toBe(200);
    expect(res.body.parent_id).toBe(parentCategory.id);
  });

  test('returns 400 for non-numeric id', async () => {
    const res = await request(app).get('/api/categories/abc');

    expect(res.status).toBe(400);
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/categories/999999');

    expect(res.status).toBe(404);
  });

});





describe('POST /api/categories', () => {

  test('admin can create a category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'TEST_UPDATE_CATEGORY' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('TEST_UPDATE_CATEGORY');

    if (res.body.id) createdIds.push(res.body.id);
  });

  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/categories')
      .send({ name: 'NO_AUTH_CATEGORY' });

    expect(res.status).toBe(401);
  });

  test('non-admin user gets 403', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${userToken()}`)
      .send({ name: 'USER_CATEGORY' });

    expect(res.status).toBe(403);
  });

  test('requires name', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('rejects duplicate name', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'TEST_PARENT_CATEGORY' });

    expect(res.status).toBe(400);
  });

  test('can create with a valid parent_id', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'TEMP_WITH_PARENT', parent_id: parentCategory.id });

    expect(res.status).toBe(201);
    expect(res.body.parent_id).toBe(parentCategory.id);

    if (res.body.id) createdIds.push(res.body.id);
  });

});





describe('PUT /api/categories/:id', () => {

  test('admin can update a category', async () => {
    const created = await db.query(`
      INSERT INTO categories (name) VALUES ('TEMP_UPDATE') RETURNING *
    `);
    const id = created.rows[0].id;
    createdIds.push(id);

    const res = await request(app)
      .put(`/api/categories/${id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'UPDATED_CATEGORY', parent_id: null });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('UPDATED_CATEGORY');
  });

  test('requires authentication', async () => {
    const res = await request(app)
      .put(`/api/categories/${parentCategory.id}`)
      .send({ name: 'NOPE' });

    expect(res.status).toBe(401);
  });

  test('non-admin user gets 403', async () => {
    const res = await request(app)
      .put(`/api/categories/${parentCategory.id}`)
      .set('Authorization', `Bearer ${userToken()}`)
      .send({ name: 'NOPE' });

    expect(res.status).toBe(403);
  });

  test('returns 400 for non-numeric id', async () => {
    const res = await request(app)
      .put('/api/categories/abc')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(400);
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app)
      .put('/api/categories/999999')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(404);
  });

  test('category cannot be its own parent', async () => {
    const res = await request(app)
      .put(`/api/categories/${parentCategory.id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ name: parentCategory.name, parent_id: parentCategory.id });

    expect(res.status).toBe(400);
  });

});





describe('DELETE /api/categories/:id', () => {

  test('cannot delete a category that has children', async () => {
    const res = await request(app)
      .delete(`/api/categories/${parentCategory.id}`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(400);
  });

  test('admin can delete a leaf category', async () => {
    const created = await db.query(`
      INSERT INTO categories (name) VALUES ('DELETE_ME') RETURNING *
    `);
    const id = created.rows[0].id;
    

    const res = await request(app)
      .delete(`/api/categories/${id}`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
  });

  test('requires authentication', async () => {
    const res = await request(app)
      .delete(`/api/categories/${childCategory.id}`);

    expect(res.status).toBe(401);
  });

  test('non-admin user gets 403', async () => {
    const res = await request(app)
      .delete(`/api/categories/${childCategory.id}`)
      .set('Authorization', `Bearer ${userToken()}`);

    expect(res.status).toBe(403);
  });

  test('returns 400 for non-numeric id', async () => {
    const res = await request(app)
      .delete('/api/categories/abc')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(400);
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app)
      .delete('/api/categories/999999')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(404);
  });

});