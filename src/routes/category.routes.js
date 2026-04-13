const express =
require("express");

const router =
express.Router();

const categoryController =
require("../controllers/category.controller");


const auth = require('../middleware/auth.middleware');
const role = require('../middleware/role.middleware');

// Optional middleware
// const authMiddleware =
// require("../middleware/auth.middleware");

// const roleMiddleware =
// require("../middleware/role.middleware");


// GET all
router.get(
  "/",
  categoryController.getCategories
);


// GET by ID
router.get(
  "/:id",
  categoryController.getCategoryById
);


// CREATE
router.post("/", auth, role("admin"), categoryController.createCategory);

// UPDATE
router.put("/:id", auth, role("admin"), categoryController.updateCategory);

// DELETE
router.delete("/:id", auth, role("admin"), categoryController.deleteCategory);

module.exports = router;