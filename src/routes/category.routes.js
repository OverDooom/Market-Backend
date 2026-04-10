const express =
require("express");

const router =
express.Router();

const categoryController =
require("../controllers/category.controller");


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
router.post(
  "/",
  // authMiddleware,
  // roleMiddleware("admin"),
  categoryController.createCategory
);


// UPDATE
router.put(
  "/:id",
  categoryController.updateCategory
);


// DELETE
router.delete(
  "/:id",
  categoryController.deleteCategory
);


module.exports = router;