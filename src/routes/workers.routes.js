const router = require('express').Router();
const ctrl = require('../controllers/workers.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

router.use(authenticate);
const canEdit = requireRole('hr_manager', 'admin');

router.get('/', ctrl.listWorkers);
router.get('/:id', ctrl.getWorker);
router.post('/', canEdit, ctrl.createWorker);
router.put('/:id', canEdit, ctrl.updateWorker);
router.post('/:id/advances', canEdit, ctrl.giveAdvance);

router.post('/attendance/bulk', canEdit, ctrl.markAttendanceBulk);
router.get('/attendance/summary', ctrl.attendanceSummary);

module.exports = router;
