const router = require('express').Router();
const ctrl = require('../controllers/production.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

router.use(authenticate);
const canEdit = requireRole('production_manager', 'admin');

router.get('/batches', ctrl.listBatches);
router.post('/batches', canEdit, ctrl.createBatch);
router.patch('/batches/:id/status', canEdit, ctrl.updateBatchStatus);
router.get('/efficiency', ctrl.efficiency);

module.exports = router;
