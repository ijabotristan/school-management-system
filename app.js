require('dotenv').config();
const express = require('express');
const authRoutes = require('./auth(1).js');
const teacherRoutes = require('./teacher');

const app = express();
app.use(express.json());
console.log('AUTH:', typeof authRoutes);
console.log('TEACHER:', typeof teacherRoutes);

app.use('/api', authRoutes);
app.use('/api', teacherRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SMS backend running on port ${PORT}`));

module.exports = app;
