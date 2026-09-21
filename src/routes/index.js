const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/finance', require('./finance.routes'));
router.use('/inventory', require('./inventory.routes'));
router.use('/workers', require('./workers.routes'));
router.use('/production', require('./production.routes'));
router.use('/sales', require('./sales.routes'));
router.use('/documents', require('./documents.routes'));
router.use('/reports', require('./reports.routes'));
router.use('/notifications', require('./notifications.routes'));
router.use('/users', require('./users.routes'));

module.exports = router;
