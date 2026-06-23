const categoryService = require("../services/category.service");



exports.getCategories = async (req, res, next) => {
  try {
    const categories = await categoryService.getAllCategories();
    res.json(categories);
  }
  catch (err) {
    next(err);
  }
};



exports.getCategoryById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const err = new Error("Invalid category ID");
      err.status = 400;
      throw err;
    }

    const category = await categoryService.getCategoryById(id);
    if (!category) {
      const err = new Error("Category not found");
      err.status = 404;
      throw err;
    }
    res.json(category);
  }
  catch (err) {
    next(err);
  }
};



exports.createCategory = async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.name) {
      const err = new Error("Category name is required");
      err.status = 400;
      throw err;
    }

    const result = await categoryService.createCategory(data);

    res.status(201).json(result);
  }
  catch (err) {
    next(err);
  }
};



exports.updateCategory = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const err = new Error("Invalid category ID");
      err.status = 400;
      throw err;
    }
    const result = await categoryService.updateCategory(id, req.body);
    res.json(result);
  }
  catch (err) {
    next(err);
  }
};



exports.deleteCategory = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      const err = new Error("Invalid category ID");
      err.status = 400;
      throw err;
    }

    const result = await categoryService.deleteCategory(id);
    res.json(result);
  }
  catch (err) {
    next(err);
  }
};