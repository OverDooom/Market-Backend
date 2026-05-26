const promotionService = require('./promotion.service');


// =========================================
// CALCULATE DISCOUNT
// =========================================

const calculateDiscount = ({ promotion, subtotal }) => {
  if (promotion.type === 'percentage') {
    return subtotal * (Number(promotion.value) / 100);
  }

  if (promotion.type === 'fixed') {
    return Number(promotion.value);
  }

  return 0;
};


// =========================================
// CALCULATE CART
// =========================================

exports.calculateCart = async ({
  client,
  userId,
  items,
  couponCodes = []
}) => {

  // =====================================
  // SUBTOTAL
  // =====================================

  let subtotal = 0;

  for (const item of items) {
    subtotal += Number(item.price) * item.quantity;
  }

  // =====================================
  // LOAD PROMOTIONS
  // =====================================

  const promotions = [];

  const automaticPromotions =
    await promotionService.getAutomaticPromotions(client);

  promotions.push(...automaticPromotions);

  for (const code of couponCodes) {
    const coupon = await promotionService.validateCoupon(code, client);
    promotions.push(coupon);
  }

  // =====================================
  // FILTER VALID PROMOTIONS
  // =====================================

  const validPromotions = [];

  for (const promotion of promotions) {
    const valid = await promotionService.validatePromotionConditions(
      { promotion, userId, subtotal },
      client
    );

    if (valid) {
      validPromotions.push(promotion);
    }
  }

  // =====================================
  // STACKABLE / NON-STACKABLE SPLIT
  // =====================================

  const nonStackable = validPromotions.filter(p => !p.stackable);
  const stackable    = validPromotions.filter(p =>  p.stackable);

  // =====================================
  // PICK BEST NON-STACKABLE
  // =====================================

  let bestPromo    = null;
  let bestDiscount = 0;

  for (const promo of nonStackable) {
    const eligibleItems = await promotionService.getEligibleItems(
      promo, items, client
    );

    let eligibleSubtotal = 0;
    for (const item of eligibleItems) {
      eligibleSubtotal += Number(item.price) * item.quantity;
    }

    const discount = calculateDiscount({
      promotion: promo,
      subtotal:  eligibleSubtotal
    });

    if (discount > bestDiscount) {
      bestDiscount = discount;
      bestPromo    = promo;
    }
  }

  // =====================================
  // BUILD FINAL PROMOTIONS LIST
  // =====================================

  // If there are non-stackable promos, take only the best one.
  // Stackable promos never compete with each other — all apply.
  // Non-stackable beats stackable; if no non-stackable exists,
  // all stackable promos apply together.

  let finalPromotions;

  if (nonStackable.length > 0) {
    finalPromotions = bestPromo ? [bestPromo] : [];
  } else {
    finalPromotions = stackable;
  }

  // =====================================
  // CALCULATE FINAL DISCOUNTS
  // =====================================

  const discounts = [];
  let discountTotal = 0;

  for (const promotion of finalPromotions) {
    const eligibleItems = await promotionService.getEligibleItems(
      promotion, items, client
    );

    let eligibleSubtotal = 0;
    for (const item of eligibleItems) {
      eligibleSubtotal += Number(item.price) * item.quantity;
    }

    if (eligibleSubtotal <= 0) continue;

    let discount = calculateDiscount({
      promotion,
      subtotal: eligibleSubtotal
    });

    // prevent over-discount
    discount = Math.min(discount, eligibleSubtotal);

    discountTotal += discount;

    discounts.push({
      promotion_id: promotion.id,
      coupon_id:    promotion.coupon_id || null,
      name:         promotion.name,
      amount:       Number(discount.toFixed(2))
    });
  }

  // =====================================
  // FINAL TOTAL
  // =====================================

  const total = Math.max(0, subtotal - discountTotal);

  return {
    subtotal:       Number(subtotal.toFixed(2)),
    discount_total: Number(discountTotal.toFixed(2)),
    total:          Number(total.toFixed(2)),
    discounts
  };
};
