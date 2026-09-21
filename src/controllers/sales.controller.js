const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

/* ---------------- CUSTOMERS ---------------- */
exports.listCustomers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const params = [];
  let where = '';
  if (search) { params.push(`%${search}%`); where = `WHERE name ILIKE $1 OR phone ILIKE $1`; }
  const { rows } = await db.query(`SELECT * FROM customers ${where} ORDER BY name`, params);
  res.json({ success: true, data: rows });
});

exports.createCustomer = asyncHandler(async (req, res) => {
  const { name, contact_person, phone, address } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'name is required' });
  const { rows } = await db.query(
    `INSERT INTO customers (name, contact_person, phone, address) VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, contact_person, phone, address]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

exports.customerLedger = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, invoice_number, invoice_date, total_amount, paid_amount, status
     FROM invoices WHERE customer_id = $1 ORDER BY invoice_date DESC`,
    [req.params.id]
  );
  res.json({ success: true, data: rows });
});

/* ---------------- INVOICES ---------------- */
exports.listInvoices = asyncHandler(async (req, res) => {
  const { status, customer_id } = req.query;
  const conditions = [];
  const params = [];
  if (status) { params.push(status); conditions.push(`i.status = $${params.length}`); }
  if (customer_id) { params.push(customer_id); conditions.push(`i.customer_id = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT i.*, c.name AS customer_name FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id ${where}
     ORDER BY invoice_date DESC`,
    params
  );
  res.json({ success: true, data: rows });
});

// POST /api/sales/invoices
// body: { customer_id, invoice_date, due_date, items: [{grade, quantity, unit_price}] }
exports.createInvoice = asyncHandler(async (req, res) => {
  const { customer_id, invoice_date, due_date, items } = req.body;
  if (!customer_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'customer_id and a non-empty items[] are required' });
  }

  const total = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const invRes = await client.query(
      `INSERT INTO invoices (invoice_number, customer_id, invoice_date, due_date, total_amount, created_by)
       VALUES ($1,$2,COALESCE($3,CURRENT_DATE),$4,$5,$6) RETURNING *`,
      [invoiceNumber, customer_id, invoice_date, due_date, total, req.user.id]
    );
    const invoiceId = invRes.rows[0].id;

    for (const it of items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, grade, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5)`,
        [invoiceId, it.grade, it.quantity, it.unit_price, it.quantity * it.unit_price]
      );
      // reserve finished stock for this grade
      await client.query(
        `UPDATE finished_products SET reserved_quantity = reserved_quantity + $1 WHERE grade = $2`,
        [it.quantity, it.grade]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: invRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

exports.getInvoice = asyncHandler(async (req, res) => {
  const invRes = await db.query(
    `SELECT i.*, c.name AS customer_name, c.phone AS customer_phone FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id WHERE i.id = $1`,
    [req.params.id]
  );
  if (invRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Invoice not found' });

  const items = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [req.params.id]);
  res.json({ success: true, data: { ...invRes.rows[0], items: items.rows } });
});

// POST /api/sales/invoices/:id/payments  body: { amount }
exports.recordInvoicePayment = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'A positive amount is required' });

  const { rows } = await db.query(
    `UPDATE invoices SET paid_amount = paid_amount + $1,
        status = CASE WHEN paid_amount + $1 >= total_amount THEN 'paid' ELSE status END
     WHERE id = $2 RETURNING *`,
    [amount, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ success: false, message: 'Invoice not found' });
  res.json({ success: true, data: rows[0] });
});
