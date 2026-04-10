// src/controllers/product.controller.js
const productService = require('../services/product.service');

exports.getAllProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || null;
    const category = req.query.category || null;

    const products = await productService.getAllProducts({
      page,
      limit,
      search,
      category
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
      return res.status(400).json({ error: 'Invalid product id' });
    }

    const product = await productService.getProductById(id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ data: product });
  } catch (err) {
    next(err);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    const { name, category_id } = req.body;

    if (!name || !category_id) {
      return res.status(400).json({
        error: 'Name and category_id are required'
      });
    }

    const newProduct = await productService.createProduct(req.body);

    res.status(201).json({ data: newProduct });
  } catch (err) {
    next(err);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }

    const updated = await productService.updateProduct(id, req.body);

    if (!updated) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }

    const deleted = await productService.deleteProduct(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
};