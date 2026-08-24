const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Verifies the JWT and attaches { userId, schoolId, role } to req.auth.
 * Every protected route reads req.auth.schoolId instead of trusting
 * anything from req.params/req.body — this is what stops School A
 * from ever touching School B's data.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = payload; // { userId, schoolId, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Usage: router.post('/attendance', requireAuth, requireRole('teacher'), handler)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Forbidden for this role' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
