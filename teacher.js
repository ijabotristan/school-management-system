const express = require('express');
const pool = require('./db/pool');
const { requireAuth, requireRole } = require('./middleware/auth');

const router = express.Router();

/**
 * GET /api/teacher/my-classes
 * Returns only the classes assigned to THIS teacher, in THEIR school.
 * schoolId comes from the verified token, never from the request.
 */
router.get('/teacher/my-classes', requireAuth, requireRole('teacher'), async (req, res) => {
  const { userId, schoolId } = req.auth;

  try {
    const teacherResult = await pool.query(
      'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2',
      [userId, schoolId]
    );
    const teacher = teacherResult.rows[0];
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const classes = await pool.query(
      `SELECT DISTINCT c.id, c.name, s.id AS subject_id, s.name AS subject_name
       FROM teacher_classes tc
       JOIN classes c ON c.id = tc.class_id
       JOIN subjects s ON s.id = tc.subject_id
       WHERE tc.teacher_id = $1 AND tc.school_id = $2
       ORDER BY c.name`,
      [teacher.id, schoolId]
    );

    res.json(classes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load classes' });
  }
});

/**
 * POST /api/teacher/attendance
 * Body: { classId, date, records: [{ studentId, status }, ...] }
 * Teacher picks "today's class" on the frontend, then submits this.
 */
router.post('/teacher/attendance', requireAuth, requireRole('teacher'), async (req, res) => {
  const { userId, schoolId } = req.auth;
  const { classId, date, records } = req.body;

  if (!classId || !date || !Array.isArray(records)) {
    return res.status(400).json({ error: 'classId, date, and records are required' });
  }

  const client = await pool.connect();
  try {
    // Guard: does this class even belong to this school? (defense in depth)
    const classCheck = await client.query(
      'SELECT id FROM classes WHERE id = $1 AND school_id = $2',
      [classId, schoolId]
    );
    if (classCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Class not in your school' });
    }

    await client.query('BEGIN');
    for (const r of records) {
      await client.query(
        `INSERT INTO attendance (school_id, student_id, class_id, date, status, marked_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (student_id, date)
         DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by`,
        [schoolId, r.studentId, classId, date, r.status, userId]
      );
    }
    await client.query('COMMIT');

    res.json({ message: 'Attendance saved', count: records.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to save attendance' });
  } finally {
    client.release();
  }
});

module.exports = router;
