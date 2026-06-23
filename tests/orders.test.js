const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { adminToken } = require('./helpers/auth');





async function createUser(suffix) {
  const email = `ord_${suffix}_${Date.now()}@mail.com`;
  const hash = await bcrypt.hash('Password123', 10);
  const res = await db.query(
    `INSERT INTO users (name, email, password_hash, role_id) VALUES ($1,$2,$3,1) RETURNING id`,
    [`ord_${suffix}`, email, hash]
  );
  const id = res.rows[0].id;
  const token = jwt.sign({ id, role: 'user' }, process.env.JWT_SECRET);
  return { id, token };
}





async function setupCheckout(suffix) {
  const user = await createUser(suffix);

  
  const addrRes = await db.query(
    `INSERT INTO addresses (user_id, city, street) VALUES ($1,'TestCity','TestSt') RETURNING id`,
    [user.id]
  );
  const addressId = addrRes.rows[0].id;

  
  const cartRes = await db.query(
    `INSERT INTO carts (user_id) VALUES ($1) RETURNING id`,
    [user.id]
  );
  const cartId = cartRes.rows[0].id;

  
  await db.query(
    `INSERT INTO cart_items (cart_id, product_variant_id, quantity) VALUES ($1,$2,1)`,
    [cartId, sharedVariantId]
  );

  return { user, addressId, cartId };
}

const createdUserIds = [];
let sharedVariantId;

beforeAll(async () => {
  await db.query(`INSERT INTO categories (id, name) VALUES (1,'Test Category') ON CONFLICT DO NOTHING`);

  
  const prod = await db.query(
    `INSERT INTO products (name, category_id) VALUES ('Order Test Product', 1) RETURNING id`
  );
  const productId = prod.rows[0].id;

  const vRes = await db.query(
    `INSERT INTO product_variants (product_id, price, quantity, sku)
     VALUES ($1, 20.00, 1000, 'ORD-V1') RETURNING id`,
    [productId]
  );
  sharedVariantId = vRes.rows[0].id;
});

afterAll(async () => {
  
  if (createdUserIds.length > 0) {
    const orderRows = await db.query(
      `SELECT id FROM orders WHERE user_id = ANY($1::int[])`, [createdUserIds]
    );
    const orderIds = orderRows.rows.map(r => r.id);

    if (orderIds.length > 0) {
      await db.query(`DELETE FROM order_status_history WHERE order_id = ANY($1::int[])`, [orderIds]);
      await db.query(`DELETE FROM order_items WHERE order_id = ANY($1::int[])`, [orderIds]);
      await db.query(`DELETE FROM promotion_usage WHERE order_id = ANY($1::int[])`, [orderIds]);
      await db.query(`DELETE FROM orders WHERE id = ANY($1::int[])`, [orderIds]);
    }

    await db.query(`DELETE FROM inventory_transactions WHERE reference_id = ANY($1::int[]) AND reference_type = 'order'`, [orderIds.length > 0 ? orderIds : [0]]);
    await db.query(`DELETE FROM cart_items USING carts WHERE cart_items.cart_id = carts.id AND carts.user_id = ANY($1::int[])`, [createdUserIds]);
    await db.query(`DELETE FROM carts WHERE user_id = ANY($1::int[])`, [createdUserIds]);
    await db.query(`DELETE FROM addresses WHERE user_id = ANY($1::int[])`, [createdUserIds]);
    await db.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [createdUserIds]);
  }

  await db.query(`DELETE FROM product_variants WHERE sku = 'ORD-V1'`);
  await db.query(`DELETE FROM products WHERE name = 'Order Test Product'`);
  await db.end();
});





describe('POST /api/orders/checkout', () => {

  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/orders/checkout')
      .send({ address_id: 1 });

    expect(res.status).toBe(401);
  });

  test('creates an order successfully', async () => {
    const { user, addressId } = await setupCheckout('co_ok');
    createdUserIds.push(user.id);

    const res = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ address_id: addressId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('order');
    expect(res.body).toHaveProperty('pricing');
    expect(res.body.order.user_id).toBe(user.id);
  });

  test('cart is cleared after successful checkout', async () => {
    const { user, addressId } = await setupCheckout('co_clear');
    createdUserIds.push(user.id);

    await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ address_id: addressId });

    const cart = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${user.token}`);

    expect(cart.body.items.length).toBe(0);
  });

  test('fails when cart is empty', async () => {
    const user = await createUser('co_empty');
    createdUserIds.push(user.id);

    const addrRes = await db.query(
      `INSERT INTO addresses (user_id, city, street) VALUES ($1,'C','S') RETURNING id`,
      [user.id]
    );

    const res = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ address_id: addrRes.rows[0].id });

    expect(res.status).toBe(400);
  });

  test('requires address_id', async () => {
    const { user } = await setupCheckout('co_noaddr');
    createdUserIds.push(user.id);

    const res = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${user.token}`)
      .send({});

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('rejects address belonging to another user', async () => {
    const { user } = await setupCheckout('co_badaddr');
    const otherUser = await createUser('co_addrowner');
    createdUserIds.push(user.id, otherUser.id);

    const addrRes = await db.query(
      `INSERT INTO addresses (user_id, city, street) VALUES ($1,'X','Y') RETURNING id`,
      [otherUser.id]
    );

    const res = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ address_id: addrRes.rows[0].id });

    expect(res.status).toBe(400);
  });

  test('rejects invalid coupon code', async () => {
    const { user, addressId } = await setupCheckout('co_badcoupon');
    createdUserIds.push(user.id);

    const res = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ address_id: addressId, coupons: ['INVALID_COUPON_XYZ'] });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('rejects non-array coupons field', async () => {
    const { user, addressId } = await setupCheckout('co_badcoupons');
    createdUserIds.push(user.id);

    const res = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ address_id: addressId, coupons: 'NOTANARRAY' });

    expect(res.status).toBe(400);
  });

});





describe('GET /api/orders', () => {

  test('requires authentication', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  test('returns an array', async () => {
    const user = await createUser('myorders');
    createdUserIds.push(user.id);

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('only returns orders belonging to the user', async () => {
    const { user, addressId } = await setupCheckout('myord_own');
    createdUserIds.push(user.id);

    await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ address_id: addressId });

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach(o => expect(o.user_id).toBe(user.id));
  });

});





describe('GET /api/orders/:id', () => {

  test('requires authentication', async () => {
    const res = await request(app).get('/api/orders/1');
    expect(res.status).toBe(401);
  });

  test('returns the order with items', async () => {
    const { user, addressId } = await setupCheckout('getord');
    createdUserIds.push(user.id);

    const checkout = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ address_id: addressId });

    const orderId = checkout.body.order.id;

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(orderId);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test('returns 404 for order belonging to another user', async () => {
    const { user: owner, addressId } = await setupCheckout('ordowner');
    const other = await createUser('ordother');
    createdUserIds.push(owner.id, other.id);

    const checkout = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ address_id: addressId });

    const orderId = checkout.body.order.id;

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${other.token}`);

    expect(res.status).toBe(404);
  });

  test('returns 404 for non-existent order', async () => {
    const user = await createUser('ordmissing');
    createdUserIds.push(user.id);

    const res = await request(app)
      .get('/api/orders/999999')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(404);
  });

});





describe('POST /api/orders/:id/cancel', () => {

  test('requires authentication', async () => {
    const res = await request(app).post('/api/orders/1/cancel');
    expect(res.status).toBe(401);
  });

  test('user can cancel their own pending order', async () => {
    const { user, addressId } = await setupCheckout('cancel_ok');
    createdUserIds.push(user.id);

    const checkout = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ address_id: addressId });

    const orderId = checkout.body.order.id;

    const res = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  test('cannot cancel an already cancelled order', async () => {
    const { user, addressId } = await setupCheckout('cancel_twice');
    createdUserIds.push(user.id);

    const checkout = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ address_id: addressId });

    const orderId = checkout.body.order.id;

    await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${user.token}`);

    const res = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(400);
  });

  test('cannot cancel another user\'s order', async () => {
    const { user: owner, addressId } = await setupCheckout('cancel_other');
    const other = await createUser('cancel_steal');
    createdUserIds.push(owner.id, other.id);

    const checkout = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ address_id: addressId });

    const orderId = checkout.body.order.id;

    const res = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${other.token}`);

    expect(res.status).toBe(404);
  });

  test('returns 404 for non-existent order', async () => {
    const user = await createUser('cancel_missing');
    createdUserIds.push(user.id);

    const res = await request(app)
      .post('/api/orders/999999/cancel')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(404);
  });

});





describe('GET /api/orders/:id/history', () => {

  test('requires authentication', async () => {
    const res = await request(app).get('/api/orders/1/history');
    expect(res.status).toBe(401);
  });

  test('owner can view status history', async () => {
    const { user, addressId } = await setupCheckout('hist_ok');
    createdUserIds.push(user.id);

    const checkout = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ address_id: addressId });

    const orderId = checkout.body.order.id;

    const res = await request(app)
      .get(`/api/orders/${orderId}/history`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('to_status');
  });

  test('returns 404 for another user\'s order history', async () => {
    const { user: owner, addressId } = await setupCheckout('hist_owner');
    const other = await createUser('hist_other');
    createdUserIds.push(owner.id, other.id);

    const checkout = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ address_id: addressId });

    const orderId = checkout.body.order.id;

    const res = await request(app)
      .get(`/api/orders/${orderId}/history`)
      .set('Authorization', `Bearer ${other.token}`);

    expect(res.status).toBe(404);
  });

});





describe('PUT /api/orders/:id/status', () => {

  test('requires authentication', async () => {
    const res = await request(app)
      .put('/api/orders/1/status')
      .send({ status: 'paid' });

    expect(res.status).toBe(401);
  });

  test('requires admin role', async () => {
    const user = await createUser('status_nonadmin');
    createdUserIds.push(user.id);

    const res = await request(app)
      .put('/api/orders/1/status')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ status: 'paid' });

    expect(res.status).toBe(403);
  });

  test('requires status field', async () => {
    const res = await request(app)
      .put('/api/orders/1/status')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('admin can advance order status', async () => {
    const { user, addressId } = await setupCheckout('status_adv');
    createdUserIds.push(user.id);

    const checkout = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ address_id: addressId });

    const orderId = checkout.body.order.id;

    const res = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ status: 'paid', notes: 'Payment received' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
  });

  test('rejects invalid status transition', async () => {
    const { user, addressId } = await setupCheckout('status_bad');
    createdUserIds.push(user.id);

    const checkout = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ address_id: addressId });

    const orderId = checkout.body.order.id;

    const res = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ status: 'delivered' }); 

    expect(res.status).toBe(400);
  });

  test('returns 404 for non-existent order', async () => {
    const res = await request(app)
      .put('/api/orders/999999/status')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ status: 'paid' });

    expect(res.status).toBe(404);
  });

  test('admin can cancel a pending order', async () => {
    const { user, addressId } = await setupCheckout('status_cancel');
    createdUserIds.push(user.id);

    const checkout = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ address_id: addressId });

    const orderId = checkout.body.order.id;

    const res = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ status: 'cancelled', notes: 'Admin cancelled' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

});
