const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/register', authenticate, requireRole('super_admin', 'admin'), ctrl.register);
router.get('/me', authenticate, ctrl.me);

module.exports = router;
