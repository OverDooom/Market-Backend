const db = require("../config/db");

// GET ALL categories
exports.getAllCategories =
async () => {
  const query = `
    SELECT
      c.id,
      c.name,
      c.parent_id,
      p.name AS parent_name
    FROM categories c
    LEFT JOIN categories p
    ON c.parent_id = p.id
    ORDER BY c.name
  `;
  const result = await db.query(query);


  if (result.rows.length === 0) return [];

  return result.rows;
};




// GET category BY ID
exports.getCategoryById =
async (id) => {
  const result =
    await db.query(
      "SELECT * FROM categories WHERE id = $1",
      [id]
    );

  if (result.rows.length === 0) {
    const err = new Error("Category not found");
    err.status = 404;
    throw err;
  }
  return result.rows[0];

};


// CREATE category

exports.createCategory = async (data) => {

  // Check duplicate name
  const duplicate =
    await db.query(
      "SELECT id FROM categories WHERE name = $1",
      [data.name]
    );

  if (duplicate.rows.length > 0) {
    const err = new Error("Category name already exists");
    err.status = 400;
    throw err;

  }

  const result =
    await db.query(

      `INSERT INTO categories
      (name, parent_id)

      VALUES ($1,$2)

      RETURNING *`,

      [
        data.name,
        data.parent_id || null
      ]

    );

  return result.rows[0];

};


// UPDATE category
exports.updateCategory = async (id, data) => {

  // Check exists
  const existing =
    await db.query(
      "SELECT id FROM categories WHERE id=$1",
      [id]
    );

  if (existing.rows.length === 0) {
    const err = new Error("Category not found");
    err.status = 404;
    throw err;
  }

  // Prevent self-parent
  if (data.parent_id == id) {
    const err = new Error("Invalid parent category");
    err.status = 400;
    throw err;
  }

  const result =
    await db.query(

      `UPDATE categories
       SET name=$1,
           parent_id=$2
       WHERE id=$3
       RETURNING *`,

      [
        data.name,
        data.parent_id || null,
        id
      ]

    );

  return result.rows[0];

};


// DELETE category BY ID
exports.deleteCategory = async (id) => {

  // Check children
  const children = await db.query(
      `SELECT id
       FROM categories
       WHERE parent_id = $1`,
      [id]
    );

  if (children.rows.length > 0) {

    const err = new Error("Category has children");
    err.status = 400;
    throw err;

  }

  const result =
    await db.query(
      `DELETE FROM categories
       WHERE id=$1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      const err = new Error("Category not found");
      err.status = 404;
      throw err;
    }

  return result.rows[0];
};