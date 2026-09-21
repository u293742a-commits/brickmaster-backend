const router = require('express').Router();
const ctrl = require('../controllers/sales.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');

router.use(authenticate);
const canEdit = requireRole('admin', 'finance_manager');

router.get('/customers', ctrl.listCustomers);
router.post('/customers', canEdit, ctrl.createCustomer);
router.get('/customers/:id/ledger', ctrl.customerLedger);

router.get('/invoices', ctrl.listInvoices);
router.post('/invoices', canEdit, ctrl.createInvoice);
router.get('/invoices/:id', ctrl.getInvoice);
router.post('/invoices/:id/payments', canEdit, ctrl.recordInvoicePayment);

module.exports = router;
