const productService = require('../services/product.service');

exports.getAllProducts = async (req, res, next) => {
  try {
    const page     = parseInt(req.query.page)  || 1;
    const limit    = Math.min(parseInt(req.query.limit) || 10, 100);
    const search   = req.query.search   || null;
    const category = req.query.category || null;

    const products = await productService.getAllProducts({
      page, limit, search, category
    });

    res.json({ data: products });
  } catch (err) {
    next(err);
  }
};

exports.getProductById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      const err = new Error('Invalid product id');
      err.status = 400;
      throw err;
    }

    const product = await productService.getProductById(id);
    res.json(product);
  } catch (err) {
    next(err);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    const { name, category_id } = req.body;

    if (!name || !category_id) {
      const err = new Error('Name and category_id are required');
      err.status = 400;
      throw err;
    }

    // Pass admin id so it's recorded in created_by
    const newProduct = await productService.createProduct(
      req.body,
      req.user?.id ?? null
    );

    res.status(201).json(newProduct);
  } catch (err) {
    next(err);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      const err = new Error('Invalid product id');
      err.status = 400;
      throw err;
    }

    // Pass admin id so it's recorded in updated_by
    const updated = await productService.updateProduct(
      id,
      req.body,
      req.user?.id ?? null
    );

    if (!updated) {
      const err = new Error('Product not found');
      err.status = 404;
      throw err;
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      const err = new Error('Invalid product id');
      err.status = 400;
      throw err;
    }

    const deleted = await productService.deleteProduct(id);

    if (!deleted) {
      const err = new Error('Product not found');
      err.status = 404;
      throw err;
    }

    res.json({ message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
};
