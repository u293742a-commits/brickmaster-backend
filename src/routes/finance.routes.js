const router = require('express').Router();
const ctrl = require('../controllers/finance.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

router.use(authenticate);
const canEdit = requireRole('finance_manager', 'admin');

router.get('/income', ctrl.listIncome);
router.post('/income', canEdit, ctrl.createIncome);

router.get('/expenses', ctrl.listExpenses);
router.post('/expenses', canEdit, ctrl.createExpense);

router.get('/loans', ctrl.listLoans);
router.post('/loans', canEdit, ctrl.createLoan);
router.post('/loans/:id/payments', canEdit, ctrl.recordLoanPayment);

router.get('/reports/profit-loss', ctrl.profitAndLoss);

module.exports = router;
