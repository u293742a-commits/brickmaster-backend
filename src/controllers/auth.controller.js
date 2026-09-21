const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/auth/register  (Super Admin only in practice - protect route accordingly)
exports.register = asyncHandler(async (req, res) => {
  const { full_name, email, password, role_name, phone } = req.body;
  if (!full_name || !email || !password || !role_name) {
    return res.status(400).json({ success: false, message: 'full_name, email, password, role_name are required' });
  }

  const roleRes = await db.query('SELECT id FROM roles WHERE name = $1', [role_name]);
  if (roleRes.rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid role_name' });
  }

  const password_hash = await bcrypt.hash(password, 12);
  const { rows } = await db.query(
    `INSERT INTO users (full_name, email, password_hash, role_id, phone)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, full_name, email, phone, created_at`,
    [full_name, email, password_hash, roleRes.rows[0].id, phone || null]
  );

  res.status(201).json({ success: true, data: rows[0] });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'email and password are required' });
  }

  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.email, u.password_hash, u.is_active, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.email = $1`,
    [email]
  );
  const user = rows[0];

  if (!user || !user.is_active) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id });

  await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
    },
  });
});

// POST /api/auth/refresh
exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'refreshToken is required' });
  }
  try {
    const decoded = verifyRefreshToken(refreshToken);
    const { rows } = await db.query(
      `SELECT u.id, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [decoded.sub]
    );
    if (rows.length === 0) return res.status(401).json({ success: false, message: 'User not found' });

    const accessToken = signAccessToken({ sub: rows[0].id, role: rows[0].role });
    res.json({ success: true, data: { accessToken } });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});
