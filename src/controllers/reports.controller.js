const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ExcelJS = require('exceljs');

// GET /api/reports/dashboard-summary
exports.dashboardSummary = asyncHandler(async (req, res) => {
  const [produced, sold, income, expenses, loans, workers] = await Promise.all([
    db.query(`SELECT COALESCE(SUM(quantity_produced),0) AS total FROM production_batches WHERE production_date >= date_trunc('month', CURRENT_DATE)`),
    db.query(`SELECT COALESCE(SUM(quantity),0) AS total FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE i.invoice_date >= date_trunc('month', CURRENT_DATE)`),
    db.query(`SELECT COALESCE(SUM(amount),0) AS total FROM income WHERE income_date >= date_trunc('month', CURRENT_DATE) AND status='paid'`),
    db.query(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE expense_date >= date_trunc('month', CURRENT_DATE)`),
    db.query(`SELECT COALESCE(SUM(principal_amount - returned_amount),0) AS total FROM loans WHERE status != 'cleared'`),
    db.query(`SELECT COUNT(*) AS total FROM workers WHERE status = 'active'`),
  ]);

  res.json({
    success: true,
    data: {
      bricks_produced_mtd: Number(produced.rows[0].total),
      bricks_sold_mtd: Number(sold.rows[0].total),
      revenue_mtd: Number(income.rows[0].total),
      expenses_mtd: Number(expenses.rows[0].total),
      net_profit_mtd: Number(income.rows[0].total) - Number(expenses.rows[0].total),
      outstanding_loans: Number(loans.rows[0].total),
      active_workers: Number(workers.rows[0].total),
    },
  });
});

// GET /api/reports/export/:type  type = income|expenses|workers|inventory|invoices  format=xlsx|csv
exports.exportData = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const format = req.query.format || 'xlsx';

  const queries = {
    income: 'SELECT income_date, source, description, payment_method, amount, status FROM income ORDER BY income_date DESC',
    expenses: 'SELECT expense_date, category, description, paid_to, amount FROM expenses ORDER BY expense_date DESC',
    workers: 'SELECT full_name, cnic, mobile_number, status, daily_wage, monthly_salary FROM workers ORDER BY full_name',
    inventory: 'SELECT name, unit, quantity_on_hand, reorder_level FROM raw_materials ORDER BY name',
    invoices: 'SELECT invoice_number, invoice_date, total_amount, paid_amount, status FROM invoices ORDER BY invoice_date DESC',
  };

  if (!queries[type]) {
    return res.status(400).json({ success: false, message: 'Unsupported export type' });
  }

  const { rows } = await db.query(queries[type]);

  if (format === 'csv') {
    const header = rows.length ? Object.keys(rows[0]).join(',') : '';
    const lines = rows.map((r) => Object.values(r).map((v) => `"${v ?? ''}"`).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
    return res.send([header, ...lines].join('\n'));
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(type);
  if (rows.length) {
    sheet.columns = Object.keys(rows[0]).map((key) => ({ header: key, key, width: 22 }));
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${type}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});
