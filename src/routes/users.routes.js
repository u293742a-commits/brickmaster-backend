const router = require('express').Router();
const ctrl = require('../controllers/users.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

router.use(authenticate, requireRole('admin'));

router.get('/', ctrl.listUsers);
router.get('/roles', ctrl.listRoles);
router.patch('/:id/status', ctrl.updateUserStatus);
router.get('/audit-log', ctrl.auditLog);

module.exports = router;
