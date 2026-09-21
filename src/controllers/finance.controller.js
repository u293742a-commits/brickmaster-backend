const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

/* ---------------- INCOME ---------------- */
exports.listIncome = asyncHandler(async (req, res) => {
  const { from, to, status, page = 1, limit = 25 } = req.query;
  const conditions = [];
  const params = [];
  if (from) { params.push(from); conditions.push(`income_date >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`income_date <= $${params.length}`); }
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, (page - 1) * limit);
  const { rows } = await db.query(
    `SELECT * FROM income ${where} ORDER BY income_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ success: true, data: rows });
});

exports.createIncome = asyncHandler(async (req, res) => {
  const { income_date, source, customer_id, description, payment_method, amount, status } = req.body;
  const { rows } = await db.query(
    `INSERT INTO income (income_date, source, customer_id, description, payment_method, amount, status, recorded_by)
     VALUES (COALESCE($1, CURRENT_DATE), $2,$3,$4,$5,$6,COALESCE($7,'paid'),$8) RETURNING *`,
    [income_date, source, customer_id || null, description, payment_method, amount, status, req.user.id]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

/* ---------------- EXPENSES ---------------- */
exports.listExpenses = asyncHandler(async (req, res) => {
  const { category, from, to } = req.query;
  const conditions = [];
  const params = [];
  if (category) { params.push(category); conditions.push(`category = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`expense_date >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`expense_date <= $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(`SELECT * FROM expenses ${where} ORDER BY expense_date DESC`, params);
  res.json({ success: true, data: rows });
});

exports.createExpense = asyncHandler(async (req, res) => {
  const { expense_date, category, description, paid_to, amount } = req.body;
  if (!category || !amount) {
    return res.status(400).json({ success: false, message: 'category and amount are required' });
  }
  const { rows } = await db.query(
    `INSERT INTO expenses (expense_date, category, description, paid_to, amount, recorded_by)
     VALUES (COALESCE($1, CURRENT_DATE), $2,$3,$4,$5,$6) RETURNING *`,
    [expense_date, category, description, paid_to, amount, req.user.id]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

/* ---------------- LOANS ---------------- */
exports.listLoans = asyncHandler(async (req, res) => {
  const { status, loan_type } = req.query;
  const conditions = [];
  const params = [];
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  if (loan_type) { params.push(loan_type); conditions.push(`loan_type = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT *, (principal_amount - returned_amount) AS balance FROM loans ${where} ORDER BY loan_date DESC`,
    params
  );
  res.json({ success: true, data: rows });
});

exports.createLoan = asyncHandler(async (req, res) => {
  const { party_name, loan_type, principal_amount, loan_date, due_date, notes } = req.body;
  if (!party_name || !loan_type || !principal_amount) {
    return res.status(400).json({ success: false, message: 'party_name, loan_type, principal_amount are required' });
  }
  const { rows } = await db.query(
    `INSERT INTO loans (party_name, loan_type, principal_amount, loan_date, due_date, notes, created_by)
     VALUES ($1,$2,$3,COALESCE($4,CURRENT_DATE),$5,$6,$7) RETURNING *`,
    [party_name, loan_type, principal_amount, loan_date, due_date, notes, req.user.id]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

// POST /api/finance/loans/:id/payments
exports.recordLoanPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, payment_date, notes } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'A positive amount is required' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO loan_payments (loan_id, amount, payment_date, notes) VALUES ($1,$2,COALESCE($3,CURRENT_DATE),$4)`,
      [id, amount, payment_date, notes]
    );
    const { rows } = await client.query(
      `UPDATE loans SET returned_amount = returned_amount + $1,
              status = CASE WHEN returned_amount + $1 >= principal_amount THEN 'cleared' ELSE status END
       WHERE id = $2 RETURNING *`,
      [amount, id]
    );
    await client.query('COMMIT');
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/* ---------------- REPORTS ---------------- */
// GET /api/finance/reports/profit-loss?from=YYYY-MM-DD&to=YYYY-MM-DD
exports.profitAndLoss = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const params = [from || '2000-01-01', to || '2100-01-01'];

  const incomeRes = await db.query(
    `SELECT COALESCE(SUM(amount),0) AS total_income FROM income WHERE income_date BETWEEN $1 AND $2 AND status = 'paid'`,
    params
  );
  const expenseRes = await db.query(
    `SELECT COALESCE(SUM(amount),0) AS total_expenses FROM expenses WHERE expense_date BETWEEN $1 AND $2`,
    params
  );
  const byCategory = await db.query(
    `SELECT category, SUM(amount) AS total FROM expenses WHERE expense_date BETWEEN $1 AND $2 GROUP BY category ORDER BY total DESC`,
    params
  );

  const total_income = Number(incomeRes.rows[0].total_income);
  const total_expenses = Number(expenseRes.rows[0].total_expenses);

  res.json({
    success: true,
    data: {
      period: { from: params[0], to: params[1] },
      total_income,
      total_expenses,
      net_profit: total_income - total_expenses,
      expenses_by_category: byCategory.rows,
    },
  });
});
