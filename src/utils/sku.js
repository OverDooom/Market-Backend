const db = require('../config/db');


const ATTRIBUTE_ORDER = {
  Color: 1,
  Size: 2
  
};

async function generateSKU({ variantId, productId }) {
  
  const productRes = await db.query(
    `SELECT p.name, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.id = $1`,
    [productId]
  );

  const product = productRes.rows[0];

  
  const categoryCode = cleanCode(product.category_name, 3);
  const productCode = cleanCode(product.name, 8);

  
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

  
  attributes.sort((a, b) => {
    return (ATTRIBUTE_ORDER[a.attribute_name] || 99) -
           (ATTRIBUTE_ORDER[b.attribute_name] || 99);
  });

  
  const attrPart = attributes
    .map(a => a.value_code)
    .join('-');

  
  const countRes = await db.query(
    `SELECT COUNT(*) FROM product_variants WHERE product_id = $1`,
    [productId]
  );

  const count = parseInt(countRes.rows[0].count) + 1;

  const sequence = String(count).padStart(4, '0');

  
  return `${categoryCode}-${productCode}-${attrPart}-${sequence}`;
}


function cleanCode(str, maxLength) {
  if (!str) return 'UNK';

  return str
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') 
    .substring(0, maxLength);
}

module.exports = { generateSKU };