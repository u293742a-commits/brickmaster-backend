// Usage: router.post('/', authenticate, requireRole('super_admin', 'finance_manager'), handler)
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    // super_admin always passes
    if (req.user.role === 'super_admin' || allowedRoles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
    });
  };
}

module.exports = { requireRole };
