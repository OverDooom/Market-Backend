const promotionAdminService = require('../services/promotion.admin.service');





exports.listPromotions = async (req, res, next) => {
  try {
    
    let active;
    if (req.query.active !== undefined) {
      active = req.query.active === 'true';
    }

    const promotions = await promotionAdminService.listPromotions({ active });
    res.json(promotions);
  } catch (err) {
    next(err);
  }
};





exports.getPromotion = async (req, res, next) => {
  try {
    const promotion = await promotionAdminService.getPromotion(
      parseInt(req.params.id)
    );
    res.json(promotion);
  } catch (err) {
    next(err);
  }
};





exports.createPromotion = async (req, res, next) => {
  try {
    const promotion = await promotionAdminService.createPromotion(req.body);
    res.status(201).json(promotion);
  } catch (err) {
    next(err);
  }
};





exports.updatePromotion = async (req, res, next) => {
  try {
    const promotion = await promotionAdminService.updatePromotion(
      parseInt(req.params.id),
      req.body
    );
    res.json(promotion);
  } catch (err) {
    next(err);
  }
};





exports.togglePromotion = async (req, res, next) => {
  try {
    const promotion = await promotionAdminService.togglePromotion(
      parseInt(req.params.id)
    );
    res.json(promotion);
  } catch (err) {
    next(err);
  }
};





exports.deletePromotion = async (req, res, next) => {
  try {
    const deleted = await promotionAdminService.deletePromotion(
      parseInt(req.params.id)
    );
    res.json(deleted);
  } catch (err) {
    next(err);
  }
};





exports.getUsageStats = async (req, res, next) => {
  try {
    const stats = await promotionAdminService.getUsageStats(
      parseInt(req.params.id)
    );
    res.json(stats);
  } catch (err) {
    next(err);
  }
};





exports.addCoupons = async (req, res, next) => {
  try {
    const coupons = await promotionAdminService.addCoupons(
      parseInt(req.params.id),
      req.body.coupons
    );
    res.status(201).json(coupons);
  } catch (err) {
    next(err);
  }
};





exports.toggleCoupon = async (req, res, next) => {
  try {
    const coupon = await promotionAdminService.toggleCoupon(
      parseInt(req.params.id),
      parseInt(req.params.couponId)
    );
    res.json(coupon);
  } catch (err) {
    next(err);
  }
};





exports.deleteCoupon = async (req, res, next) => {
  try {
    const deleted = await promotionAdminService.deleteCoupon(
      parseInt(req.params.id),
      parseInt(req.params.couponId)
    );
    res.json(deleted);
  } catch (err) {
    next(err);
  }
};
