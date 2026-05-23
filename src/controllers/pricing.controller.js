const cartService =
require('../services/cart.service');

const pricingService =
require('../services/pricing.service');


exports.getCartPricing =
async (req, res, next) => {

  try {

    const cart =
      await cartService.getCart(
        req.user.id
      );

    const couponCodes =
      req.body.coupons || [];

    const pricing =
      await pricingService.calculateCart({
        userId: req.user.id,
        items: cart.items,
        couponCodes
      });

    res.json(pricing);

  } catch (err) {

    next(err);
  }
};