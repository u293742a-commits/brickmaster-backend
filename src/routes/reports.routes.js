const router = require('express').Router();
const ctrl = require('../controllers/reports.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/dashboard-summary', ctrl.dashboardSummary);
router.get('/export/:type', ctrl.exportData);

module.exports = router;
