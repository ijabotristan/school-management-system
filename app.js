require('dotenv').config();
const express = require('express');
const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teacher');

const app = express();
app.use(express.json());

app.use('/api', authRoutes);      // /api/:schoolSlug/auth/login, /api/auth/register-school
app.use('/api', teacherRoutes);   // /api/teacher/my-classes, /api/teacher/attendance

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SMS backend running on port ${PORT}`));

module.exports = app;
