const express = require("express");
const router = express.Router();

const categoryController = require("../controllers/category.controller");
const auth = require('../middleware/auth.middleware');
const role = require('../middleware/role.middleware');

// GET all categories
router.get("/", categoryController.getCategories);

// GET category by ID
router.get("/:id", categoryController.getCategoryById);

// CREATE category
router.post("/", auth, role(["admin"]), categoryController.createCategory);

// UPDATE category BY ID
router.put("/:id", auth, role(["admin"]), categoryController.updateCategory);

// DELETE category BY ID
router.delete("/:id", auth, role(["admin"]), categoryController.deleteCategory);

module.exports = router;