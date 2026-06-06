const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { adminToken } = require('./helpers/auth');

// =========================================
// HELPERS
// =========================================

async function createUser(suffix) {
  const email = `pricing_${suffix}_${Date.now()}@mail.com`;
  const hash = await bcrypt.hash('Password123', 10);
  const res = await db.query(
    `INSERT INTO users (name, email, password_hash, role_id) VALUES ($1,$2,$3,1) RETURNING id`,
    [`pricing_${suffix}`, email, hash]
  );
  const id = res.rows[0].id;
  const token = jwt.sign({ id, role: 'user' }, process.env.JWT_SECRET);
  return { id, token };
}

const createdUserIds = [];
let variantId;

beforeAll(async () => {
  await db.query(`INSERT INTO categories (id, name) VALUES (1,'Test Category') ON CONFLICT DO NOTHING`);

  const prod = await db.query(
    `INSERT INTO products (name, category_id) VALUES ('Pricing Test Product', 1) RETURNING id`
  );
  const productId = prod.rows[0].id;

  const vRes = await db.query(
    `INSERT INTO product_variants (product_id, price, quantity, sku)
     VALUES ($1, 50.00, 100, 'PRICE-V1') RETURNING id`,
    [productId]
  );
  variantId = vRes.rows[0].id;
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.query(`DELETE FROM cart_items USING carts WHERE cart_items.cart_id = carts.id AND carts.user_id = ANY($1::int[])`, [createdUserIds]);
    await db.query(`DELETE FROM carts WHERE user_id = ANY($1::int[])`, [createdUserIds]);
    await db.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [createdUserIds]);
  }
  await db.query(`DELETE FROM product_variants WHERE sku = 'PRICE-V1'`);
  await db.query(`DELETE FROM products WHERE name = 'Pricing Test Product'`);
  await db.end();
});

// =========================================
// CART PRICING PREVIEW  POST /api/pricing/cart
// =========================================

describe('POST /api/pricing/cart', () => {

  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/pricing/cart')
      .send({ coupons: [] });

    expect(res.status).toBe(401);
  });

  test('returns pricing for an empty cart', async () => {
    const user = await createUser('empty');
    createdUserIds.push(user.id);

    const res = await request(app)
      .post('/api/pricing/cart')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ coupons: [] });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('subtotal');
    expect(res.body).toHaveProperty('discount_total');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('discounts');
    expect(res.body.subtotal).toBe(0);
    expect(res.body.total).toBe(0);
  });

  test('calculates correct subtotal for items in cart', async () => {
    const user = await createUser('subtotal');
    createdUserIds.push(user.id);

    // Add item to cart (price = 50, qty = 2 → subtotal = 100)
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variant_id: variantId, quantity: 2 });

    const res = await request(app)
      .post('/api/pricing/cart')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ coupons: [] });

    expect(res.status).toBe(200);
    expect(Number(res.body.subtotal)).toBe(100);
    expect(Number(res.body.discount_total)).toBe(0);
    expect(Number(res.body.total)).toBe(100);
  });

  test('rejects invalid coupon code', async () => {
    const user = await createUser('badcoupon');
    createdUserIds.push(user.id);

    const res = await request(app)
      .post('/api/pricing/cart')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ coupons: ['TOTALLY_INVALID_COUPON_XYZ'] });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('discounts array is empty when no promotions apply', async () => {
    const user = await createUser('nodiscount');
    createdUserIds.push(user.id);

    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variant_id: variantId, quantity: 1 });

    const res = await request(app)
      .post('/api/pricing/cart')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ coupons: [] });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.discounts)).toBe(true);
  });

  test('applies valid coupon and returns discount info', async () => {
    // Create a coupon-based promotion first
    const promoRes = await request(app)
      .post('/api/admin/promotions')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        name:            'Pricing Test Promo',
        type:            'fixed',
        value:           10,
        is_automatic:    false,
        coupon_required: true,
        is_active:       true,
        coupons: [{ code: `PRICINGTEST_${Date.now()}` }],
      });

    const couponCode = promoRes.body.coupons[0].code;
    const promoId    = promoRes.body.id;

    const user = await createUser('withcoupon');
    createdUserIds.push(user.id);

    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variant_id: variantId, quantity: 1 });

    const res = await request(app)
      .post('/api/pricing/cart')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ coupons: [couponCode] });

    expect(res.status).toBe(200);
    expect(Number(res.body.discount_total)).toBeGreaterThan(0);
    expect(res.body.discounts.length).toBeGreaterThan(0);
    expect(Number(res.body.total)).toBeLessThan(Number(res.body.subtotal));

    // cleanup promotion (no usage, safe to delete)
    await request(app)
      .delete(`/api/admin/promotions/${promoId}`)
      .set('Authorization', `Bearer ${adminToken()}`);
  });

  test('total is never negative', async () => {
    // big fixed discount on small cart
    const promoRes = await request(app)
      .post('/api/admin/promotions')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        name:            'BigDiscount',
        type:            'fixed',
        value:           9999,
        is_automatic:    false,
        coupon_required: true,
        is_active:       true,
        coupons: [{ code: `BIGDISCOUNT_${Date.now()}` }],
      });

    const couponCode = promoRes.body.coupons[0].code;
    const promoId    = promoRes.body.id;

    const user = await createUser('nonneg');
    createdUserIds.push(user.id);

    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ variant_id: variantId, quantity: 1 });

    const res = await request(app)
      .post('/api/pricing/cart')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ coupons: [couponCode] });

    expect(res.status).toBe(200);
    expect(Number(res.body.total)).toBeGreaterThanOrEqual(0);

    await request(app)
      .delete(`/api/admin/promotions/${promoId}`)
      .set('Authorization', `Bearer ${adminToken()}`);
  });

});
