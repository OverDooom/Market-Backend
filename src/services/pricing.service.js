const promotionService =
require('./promotion.service');


// =========================================
// CALCULATE CART TOTALS
// =========================================

exports.calculateCart = async ({
  userId,
  items,
  couponCodes = []
}) => {

  let subtotal = 0;

  for (const item of items) {
    subtotal += (
      Number(item.price) *
      item.quantity
    );
  }

  const appliedPromotions = [];

  // automatic promotions
  const automaticPromotions =
    await promotionService
    .getAutomaticPromotions();

  appliedPromotions.push(
    ...automaticPromotions
  );

  // coupon promotions
  for (const code of couponCodes) {

    const coupon =
      await promotionService
      .validateCoupon(code);

    appliedPromotions.push(coupon);
  }

  let discountTotal = 0;

  const discounts = [];

  for (const promo of appliedPromotions) {

    let discount = 0;

    if (promo.type === 'percentage') {

      discount =
        subtotal *
        (Number(promo.value) / 100);

    } else if (promo.type === 'fixed') {

      discount = Number(promo.value);
    }

    discountTotal += discount;

    discounts.push({
      promotion_id: promo.id,
      name: promo.name,
      amount: Number(
        discount.toFixed(2)
      )
    });
  }

  const total =
    Math.max(
      0,
      subtotal - discountTotal
    );

  return {
    subtotal,
    discount_total: Number(
      discountTotal.toFixed(2)
    ),
    total: Number(total.toFixed(2)),
    discounts
  };
};