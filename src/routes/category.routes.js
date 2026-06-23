const express = require("express");
const router = express.Router();

const categoryController = require("../controllers/category.controller");
const auth = require('../middleware/auth.middleware');
const role = require('../middleware/role.middleware');

router.get("/", categoryController.getCategories);

router.get("/:id", categoryController.getCategoryById);

router.post("/", auth, role(["admin"]), categoryController.createCategory);

router.put("/:id", auth, role(["admin"]), categoryController.updateCategory);

router.delete("/:id", auth, role(["admin"]), categoryController.deleteCategory);

module.exports = router;