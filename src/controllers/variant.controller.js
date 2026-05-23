const variantService = require('../services/variant.service');


// GET all variants
exports.getAllVariants = async (req, res, next) => {
  try {
    const variants = await variantService.getAllVariants();
    res.json(variants);
  } catch (err) {
    next(err);
  }
};


// GET variant by ID
exports.getVariantById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      const err = new Error("Invalid variant id");
      err.status = 400;
      throw err;
    }

    const variant = await variantService.getVariantById(id);
    res.json(variant);
  } catch (err) {
    next(err);
  }
};


// GET variants by product
exports.getVariantsByProduct = async (req, res, next) => {
  try {
    const productId = parseInt(req.params.productId);

    if (isNaN(productId)) {
      const err = new Error("Invalid product id");
      err.status = 400;
      throw err;
    }

    const variants = await variantService.getVariantsByProduct(productId);
    res.json(variants);
  } catch (err) {
    next(err);
  }
};


// CREATE variant
exports.createVariant = async (req, res, next) => {
  try {
    const {price} = req.body;
    const product_id = parseInt(req.params.productId);

    if (!product_id || !price) {
      const err = new Error("product_id and price are required");
      err.status = 400;
      throw err;
    }


    const newVariant = await variantService.createVariant({...req.body,product_id: parseInt(req.params.productId)});

    res.status(201).json(newVariant);
  } catch (err) {
    next(err);
  }
};


// UPDATE variant
exports.updateVariant = async (req, res, next) => {
  try {
    const id = parseInt(req.params.variantId);

    if (isNaN(id)) {
      const err = new Error("Invalid variant id");
      err.status = 400;
      throw err;
    }

    const updated = await variantService.updateVariant(id, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};


// DELETE variant
exports.deleteVariant = async (req, res, next) => {
  try {
    const id = parseInt(req.params.variantId);

    if (isNaN(id)) {
      const err = new Error("Invalid variant id");
      err.status = 400;
      throw err;
    }

    const deleted = await variantService.deleteVariant(id);
    res.json({ message: "Variant deleted", data: deleted });
  } catch (err) {
    next(err);
  }
};
