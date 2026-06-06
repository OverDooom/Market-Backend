const analyticsService = require('../services/analytics.service');

exports.getOverview = async (req, res, next) => {
  try {
    const data = await analyticsService.getOverview();
    res.json(data);
  } catch (err) { next(err); }
};

exports.getRevenue = async (req, res, next) => {
  try {
    const data = await analyticsService.getRevenue({
      period: req.query.period || 'monthly',
    });
    res.json(data);
  } catch (err) { next(err); }
};

exports.getOrderAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getOrderAnalytics({
      period: req.query.period || 'monthly',
    });
    res.json(data);
  } catch (err) { next(err); }
};

exports.getTopProducts = async (req, res, next) => {
  try {
    const data = await analyticsService.getTopProducts({
      limit: req.query.limit || 10,
    });
    res.json(data);
  } catch (err) { next(err); }
};

exports.getTopCategories = async (req, res, next) => {
  try {
    const data = await analyticsService.getTopCategories({
      limit: req.query.limit || 10,
    });
    res.json(data);
  } catch (err) { next(err); }
};

exports.getUserAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getUserAnalytics({
      limit: req.query.limit || 10,
    });
    res.json(data);
  } catch (err) { next(err); }
};

exports.getPromotionAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getPromotionAnalytics();
    res.json(data);
  } catch (err) { next(err); }
};

exports.getInventoryAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getInventoryAnalytics({
      limit: req.query.limit || 20,
    });
    res.json(data);
  } catch (err) { next(err); }
};

exports.getReviewAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getReviewAnalytics({
      limit: req.query.limit || 10,
    });
    res.json(data);
  } catch (err) { next(err); }
};

exports.getDashboard = async (req, res, next) => {
  try {
    const data = await analyticsService.getDashboard();
    res.json(data);
  } catch (err) { next(err); }
};