const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET; // set this in .env, never hardcode

/**
 * LOGIN
 * URL already carries the school context, e.g.:
 *   POST /api/:schoolSlug/auth/login   { email, password }
 * No one types a school name/code into a text box — it comes from the
 * subdomain or a school-picker screen that resolves to a slug first.
 */
router.post('/:schoolSlug/auth/login', async (req, res) => {
  const { schoolSlug } = req.params;
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    // 1. Resolve school from slug
    const schoolResult = await pool.query(
      'SELECT id, name, is_active FROM schools WHERE slug = $1',
      [schoolSlug]
    );
    const school = schoolResult.rows[0];
    if (!school || !school.is_active) {
      return res.status(404).json({ error: 'School not found' });
    }

    // 2. Look up user scoped to THAT school only
    const userResult = await pool.query(
      `SELECT id, email, password_hash, role, full_name, is_active
       FROM users WHERE school_id = $1 AND email = $2`,
      [school.id, email]
    );
    const user = userResult.rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3. Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 4. Issue JWT — school_id is baked into every token so every
    //    downstream query can filter by it without trusting the client
    const token = jwt.sign(
      {
        userId: user.id,
        schoolId: school.id,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
      school: { id: school.id, name: school.name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * ADMIN SIGNUP — creates a brand-new school + its first admin user.
 * This is the only "no school context yet" endpoint, because it's
 * creating the school itself.
 */
router.post('/auth/register-school', async (req, res) => {
  const { schoolName, slug, adminEmail, adminPassword, adminFullName } = req.body;

  if (!schoolName || !slug || !adminEmail || !adminPassword) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const schoolResult = await client.query(
      `INSERT INTO schools (name, slug) VALUES ($1, $2) RETURNING id`,
      [schoolName, slug]
    );
    const schoolId = schoolResult.rows[0].id;

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await client.query(
      `INSERT INTO users (school_id, email, password_hash, role, full_name)
       VALUES ($1, $2, $3, 'admin', $4)`,
      [schoolId, adminEmail, passwordHash, adminFullName]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'School created', slug });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      // unique_violation — slug already taken
      return res.status(409).json({ error: 'School slug already taken' });
    }
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
