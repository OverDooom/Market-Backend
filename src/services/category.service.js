const pool =
require("../config/db");


// =========================
// GET ALL
// =========================

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

  const result =
    await pool.query(query);

  return result.rows;

};


// =========================
// GET BY ID
// =========================

exports.getCategoryById =
async (id) => {

  const result =
    await pool.query(
      "SELECT * FROM categories WHERE id = $1",
      [id]
    );

  return result.rows[0];

};


// =========================
// CREATE
// =========================

exports.createCategory =
async (data) => {

  // Check duplicate name
  const duplicate =
    await pool.query(
      "SELECT id FROM categories WHERE name = $1",
      [data.name]
    );

  if (duplicate.rows.length > 0) {

    throw new Error(
      "CATEGORY_EXISTS"
    );

  }

  const result =
    await pool.query(

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


// =========================
// UPDATE
// =========================

exports.updateCategory =
async (id, data) => {

  // Check exists
  const existing =
    await pool.query(
      "SELECT id FROM categories WHERE id=$1",
      [id]
    );

  if (existing.rows.length === 0) {

    throw new Error(
      "CATEGORY_NOT_FOUND"
    );

  }

  // Prevent self-parent
  if (data.parent_id == id) {

    throw new Error(
      "INVALID_PARENT"
    );

  }

  const result =
    await pool.query(

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


// =========================
// DELETE
// =========================

exports.deleteCategory =
async (id) => {

  // Check children
  const children =
    await pool.query(

      `SELECT id
       FROM categories
       WHERE parent_id = $1`,

      [id]

    );

  if (children.rows.length > 0) {

    throw new Error(
      "CATEGORY_HAS_CHILDREN"
    );

  }

  const result =
    await pool.query(

      `DELETE FROM categories
       WHERE id=$1
       RETURNING *`,

      [id]

    );

  return result.rows[0];

};