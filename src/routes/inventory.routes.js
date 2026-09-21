const router = require('express').Router();
const ctrl = require('../controllers/inventory.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

router.use(authenticate);
const canEdit = requireRole('inventory_manager', 'admin');

router.get('/raw-materials', ctrl.listRawMaterials);
router.get('/finished-products', ctrl.listFinishedProducts);
router.get('/transactions', ctrl.listTransactions);
router.post('/transactions', canEdit, ctrl.createStockTransaction);
router.get('/alerts/low-stock', ctrl.lowStockAlerts);

module.exports = router;
