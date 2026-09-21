const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

exports.listUsers = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.last_login_at, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.created_at DESC`
  );
  res.json({ success: true, data: rows });
});

exports.listRoles = asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM roles ORDER BY id');
  res.json({ success: true, data: rows });
});

exports.updateUserStatus = asyncHandler(async (req, res) => {
  const { is_active } = req.body;
  const { rows } = await db.query(
    'UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2 RETURNING id, full_name, is_active',
    [is_active, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: rows[0] });
});

exports.auditLog = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT a.*, u.full_name AS user_name FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC LIMIT 100`
  );
  res.json({ success: true, data: rows });
});
