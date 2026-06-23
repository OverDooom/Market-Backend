
const express = require('express');
const router = express.Router();

const productController = require('../controllers/product.controller');
const variantController = require('../controllers/variant.controller');
const auth = require('../middleware/auth.middleware');
const role = require('../middleware/role.middleware');
const recordProductView  = require('../middleware/product_view.middleware');
const optionalAuth = require('../middleware/optional_auth.middleware');







router.get('/variants', variantController.getAllVariants);


router.get('/:productId/variants', variantController.getVariantsByProduct);


router.post('/:productId/variants', auth, role(['admin']), variantController.createVariant);


router.put('/:productId/variants/:variantId', auth, role(['admin']), variantController.updateVariant);


router.delete('/:productId/variants/:variantId', auth, role(['admin']), variantController.deleteVariant);




router.get('/', productController.getAllProducts);


router.get('/:id',optionalAuth, recordProductView, productController.getProductById);


router.post('/', auth, role(['admin']), productController.createProduct);


router.put('/:id', auth, role(['admin']), productController.updateProduct);


router.delete('/:id', auth, role(['admin']), productController.deleteProduct);


module.exports = router;