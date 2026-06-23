const variantService = require('../services/variant.service');


exports.getAllVariants = async (req, res, next) => {
  try {
    const variants = await variantService.getAllVariants();
    res.json(variants);
  } catch (err) {
    next(err);
  }
};


exports.getVariantById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      const err = new Error('Invalid variant id');
      err.status = 400;
      throw err;
    }

    const variant = await variantService.getVariantById(id);
    res.json(variant);
  } catch (err) {
    next(err);
  }
};


exports.getVariantsByProduct = async (req, res, next) => {
  try {
    const productId = parseInt(req.params.productId);

    if (isNaN(productId)) {
      const err = new Error('Invalid product id');
      err.status = 400;
      throw err;
    }

    const variants = await variantService.getVariantsByProduct(productId);
    res.json(variants);
  } catch (err) {
    next(err);
  }
};


exports.createVariant = async (req, res, next) => {
  try {
    const { price } = req.body;
    const product_id = parseInt(req.params.productId);

    if (!product_id || !price) {
      const err = new Error('product_id and price are required');
      err.status = 400;
      throw err;
    }

    const newVariant = await variantService.createVariant({
      ...req.body,
      product_id,
    });

    res.status(201).json(newVariant);
  } catch (err) {
    next(err);
  }
};


exports.updateVariant = async (req, res, next) => {
  try {
    const id = parseInt(req.params.variantId);

    if (isNaN(id)) {
      const err = new Error('Invalid variant id');
      err.status = 400;
      throw err;
    }

    
    const updated = await variantService.updateVariant(
      id,
      req.body,
      req.user?.id ?? null
    );

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

exports.deleteVariant = async (req, res, next) => {
  try {
    const id = parseInt(req.params.variantId);

    if (isNaN(id)) {
      const err = new Error('Invalid variant id');
      err.status = 400;
      throw err;
    }

    const deleted = await variantService.deleteVariant(id);
    res.json({ message: 'Variant deleted', data: deleted });
  } catch (err) {
    next(err);
  }
};
