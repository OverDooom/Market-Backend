const categoryService =
require("../services/category.service");


// =========================
// GET ALL
// =========================

exports.getCategories =
async (req, res) => {

  try {

    const categories =
      await categoryService
        .getAllCategories();

    res.json(categories);

  }
  catch (error) {

    res.status(500).json({
      message:
        "Error fetching categories"
    });

  }

};


// =========================
// GET BY ID
// =========================

exports.getCategoryById =
async (req, res) => {

  try {

    const id =
      parseInt(req.params.id);

    if (isNaN(id)) {

      return res.status(400).json({
        message: "Invalid ID"
      });

    }

    const category =
      await categoryService
        .getCategoryById(id);

    if (!category) {

      return res.status(404).json({
        message:
          "Category not found"
      });

    }

    res.json(category);

  }
  catch (error) {

    res.status(500).json({
      message:
        "Error fetching category"
    });

  }

};


// =========================
// CREATE
// =========================

exports.createCategory =
async (req, res) => {

  try {

    const data =
      req.body;

    if (!data.name) {

      return res.status(400).json({
        message:
          "Category name required"
      });

    }

    const result =
      await categoryService
        .createCategory(data);

    res.status(201)
       .json(result);

  }
  catch (error) {

    if (
      error.message ===
      "CATEGORY_EXISTS"
    ) {

      return res.status(409).json({
        message:
          "Category already exists"
      });

    }

    res.status(500).json({
      message:
        "Error creating category"
    });

  }

};


// =========================
// UPDATE
// =========================

exports.updateCategory =
async (req, res) => {

  try {

    const id =
      parseInt(req.params.id);

    if (isNaN(id)) {

      return res.status(400).json({
        message:
          "Invalid ID"
      });

    }

    const result =
      await categoryService
        .updateCategory(
          id,
          req.body
        );

    res.json(result);

  }
  catch (error) {

    if (
      error.message ===
      "CATEGORY_NOT_FOUND"
    ) {

      return res.status(404).json({
        message:
          "Category not found"
      });

    }

    if (
      error.message ===
      "INVALID_PARENT"
    ) {

      return res.status(400).json({
        message:
          "Category cannot be its own parent"
      });

    }

    res.status(500).json({
      message:
        "Error updating category"
    });

  }

};


// =========================
// DELETE
// =========================

exports.deleteCategory =
async (req, res) => {

  try {

    const id =
      parseInt(req.params.id);

    if (isNaN(id)) {

      return res.status(400).json({
        message:
          "Invalid ID"
      });

    }

    const result =
      await categoryService
        .deleteCategory(id);

    if (!result) {

      return res.status(404).json({
        message:
          "Category not found"
      });

    }

    res.json({
      message:
        "Category deleted"
    });

  }
  catch (error) {

    if (
      error.message ===
      "CATEGORY_HAS_CHILDREN"
    ) {

      return res.status(400).json({
        message:
          "Cannot delete category with subcategories"
      });

    }

    res.status(500).json({
      message:
        "Error deleting category"
    });

  }

};