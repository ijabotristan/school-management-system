require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const authRoutes = require('./auth');
const teacherRoutes = require('./teacher');
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
console.log('AUTH:', typeof authRoutes);
console.log('TEACHER:', typeof teacherRoutes);

app.use('/api', authRoutes);
app.use('/api', teacherRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SMS backend running on port ${PORT}`));

module.exports = app; app.get('/', (req, res) => {
  res.send('School Management System API is running 🚀');
});
