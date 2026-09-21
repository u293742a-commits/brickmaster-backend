const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

exports.listWorkers = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const conditions = [];
  const params = [];
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`(full_name ILIKE $${params.length} OR cnic ILIKE $${params.length})`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(`SELECT * FROM workers ${where} ORDER BY created_at DESC`, params);
  res.json({ success: true, data: rows });
});

exports.getWorker = asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM workers WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ success: false, message: 'Worker not found' });

  const advances = await db.query('SELECT * FROM worker_advances WHERE worker_id = $1 ORDER BY given_date DESC', [req.params.id]);
  const recentAttendance = await db.query(
    'SELECT * FROM attendance WHERE worker_id = $1 ORDER BY work_date DESC LIMIT 30',
    [req.params.id]
  );

  res.json({ success: true, data: { ...rows[0], advances: advances.rows, recent_attendance: recentAttendance.rows } });
});

exports.createWorker = asyncHandler(async (req, res) => {
  const {
    full_name, cnic, mobile_number, address, photo_url, joining_date,
    monthly_salary, daily_wage, source_kiln_name, contractor_name,
    contractor_contact, transfer_details, agreement_details,
  } = req.body;

  if (!full_name) {
    return res.status(400).json({ success: false, message: 'full_name is required' });
  }

  const { rows } = await db.query(
    `INSERT INTO workers (full_name, cnic, mobile_number, address, photo_url, joining_date,
        monthly_salary, daily_wage, source_kiln_name, contractor_name, contractor_contact,
        transfer_details, agreement_details, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [full_name, cnic, mobile_number, address, photo_url, joining_date, monthly_salary, daily_wage,
     source_kiln_name, contractor_name, contractor_contact, transfer_details, agreement_details, req.user.id]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

exports.updateWorker = asyncHandler(async (req, res) => {
  const fields = [
    'full_name', 'cnic', 'mobile_number', 'address', 'photo_url', 'joining_date',
    'monthly_salary', 'daily_wage', 'status', 'source_kiln_name', 'contractor_name',
    'contractor_contact', 'transfer_details', 'agreement_details',
  ];
  const updates = [];
  const params = [];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) {
      params.push(req.body[f]);
      updates.push(`${f} = $${params.length}`);
    }
  });
  if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });

  params.push(req.params.id);
  const { rows } = await db.query(
    `UPDATE workers SET ${updates.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
    params
  );
  if (rows.length === 0) return res.status(404).json({ success: false, message: 'Worker not found' });
  res.json({ success: true, data: rows[0] });
});

/* ---------------- ADVANCES ---------------- */
exports.giveAdvance = asyncHandler(async (req, res) => {
  const { amount, reason, given_date } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'A positive amount is required' });

  const { rows } = await db.query(
    `INSERT INTO worker_advances (worker_id, amount, reason, given_date) VALUES ($1,$2,$3,COALESCE($4,CURRENT_DATE)) RETURNING *`,
    [req.params.id, amount, reason, given_date]
  );
  res.status(201).json({ success: true, data: rows[0] });
});

/* ---------------- ATTENDANCE ---------------- */
// POST /api/workers/attendance/bulk  body: { work_date, entries: [{worker_id, status, overtime_hours}] }
exports.markAttendanceBulk = asyncHandler(async (req, res) => {
  const { work_date, entries } = req.body;
  if (!work_date || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ success: false, message: 'work_date and a non-empty entries[] are required' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const e of entries) {
      const { rows } = await client.query(
        `INSERT INTO attendance (worker_id, work_date, status, overtime_hours, marked_by)
         VALUES ($1,$2,$3,COALESCE($4,0),$5)
         ON CONFLICT (worker_id, work_date)
         DO UPDATE SET status = EXCLUDED.status, overtime_hours = EXCLUDED.overtime_hours
         RETURNING *`,
        [e.worker_id, work_date, e.status, e.overtime_hours, req.user.id]
      );
      results.push(rows[0]);
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: results });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

exports.attendanceSummary = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const { rows } = await db.query(
    `SELECT status, COUNT(*) AS count FROM attendance WHERE work_date = COALESCE($1, CURRENT_DATE) GROUP BY status`,
    [date]
  );
  res.json({ success: true, data: rows });
});
