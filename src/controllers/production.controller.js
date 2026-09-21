const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

exports.listBatches = asyncHandler(async (req, res) => {
  const { from, to, grade } = req.query;
  const conditions = [];
  const params = [];
  if (from) { params.push(from); conditions.push(`production_date >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`production_date <= $${params.length}`); }
  if (grade) { params.push(grade); conditions.push(`quality_grade = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT b.*, u.full_name AS supervisor_name FROM production_batches b
     LEFT JOIN users u ON u.id = b.supervisor_id ${where}
     ORDER BY production_date DESC`,
    params
  );
  res.json({ success: true, data: rows });
});

exports.createBatch = asyncHandler(async (req, res) => {
  const { batch_number, production_date, quantity_produced, quality_grade, supervisor_id, notes } = req.body;
  if (!batch_number || !quantity_produced || !quality_grade) {
    return res.status(400).json({ success: false, message: 'batch_number, quantity_produced, quality_grade are required' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO production_batches (batch_number, production_date, quantity_produced, quality_grade, supervisor_id, notes)
       VALUES ($1,COALESCE($2,CURRENT_DATE),$3,$4,$5,$6) RETURNING *`,
      [batch_number, production_date, quantity_produced, quality_grade, supervisor_id, notes]
    );
    // Credit finished goods inventory for this grade
    await client.query(
      `INSERT INTO finished_products (grade, quantity_on_hand, location)
       VALUES ($1,$2,'Yard 1')
       ON CONFLICT (grade, location) DO UPDATE SET quantity_on_hand = finished_products.quantity_on_hand + $2, updated_at = now()`,
      [quality_grade, quantity_produced]
    );
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

exports.updateBatchStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['molding', 'drying', 'firing', 'complete'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  const { rows } = await db.query(
    'UPDATE production_batches SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ success: false, message: 'Batch not found' });
  res.json({ success: true, data: rows[0] });
});

// GET /api/production/efficiency?from&to  -> A-grade % of total output
exports.efficiency = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const params = [from || '2000-01-01', to || '2100-01-01'];
  const { rows } = await db.query(
    `SELECT quality_grade, SUM(quantity_produced) AS total
     FROM production_batches WHERE production_date BETWEEN $1 AND $2
     GROUP BY quality_grade`,
    params
  );
  const total = rows.reduce((s, r) => s + Number(r.total), 0);
  const breakdown = rows.map((r) => ({ grade: r.quality_grade, total: Number(r.total), percentage: total ? +(Number(r.total) / total * 100).toFixed(1) : 0 }));
  res.json({ success: true, data: { total_produced: total, breakdown } });
});
