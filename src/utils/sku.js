const db = require('../config/db');

// map attribute order (VERY IMPORTANT)
const ATTRIBUTE_ORDER = {
  Color: 1,
  Size: 2
  // add more if needed
};

async function generateSKU({ variantId, productId }) {
  // 1. Get product info
  const productRes = await db.query(
    `SELECT p.name, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.id = $1`,
    [productId]
  );

  const product = productRes.rows[0];

  // clean product + category
  const categoryCode = cleanCode(product.category_name, 3);
  const productCode = cleanCode(product.name, 8);

  // 2. Get attribute codes
  const attrRes = await db.query(
    `SELECT 
        av.code AS value_code,
        a.name AS attribute_name
     FROM variant_attributes va
     JOIN attribute_values av ON va.attribute_value_id = av.id
     JOIN attributes a ON av.attribute_id = a.id
     WHERE va.variant_id = $1`,
    [variantId]
  );

  let attributes = attrRes.rows;

  // 3. Sort attributes (CRITICAL)
  attributes.sort((a, b) => {
    return (ATTRIBUTE_ORDER[a.attribute_name] || 99) -
           (ATTRIBUTE_ORDER[b.attribute_name] || 99);
  });

  // 4. Build attribute part
  const attrPart = attributes
    .map(a => a.value_code)
    .join('-');

  // 5. Generate sequence number
  const countRes = await db.query(
    `SELECT COUNT(*) FROM product_variants WHERE product_id = $1`,
    [productId]
  );

  const count = parseInt(countRes.rows[0].count) + 1;

  const sequence = String(count).padStart(4, '0');

  // 6. Final SKU
  return `${categoryCode}-${productCode}-${attrPart}-${sequence}`;
}

// helper to clean strings
function cleanCode(str, maxLength) {
  if (!str) return 'UNK';

  return str
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') // remove spaces/symbols
    .substring(0, maxLength);
}

module.exports = { generateSKU };