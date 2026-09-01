const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./config/db');

const authRoutes       = require('./routes/authRoutes');
const studentRoutes    = require('./routes/studentRoutes');
const teacherRoutes    = require('./routes/teacherRoutes');
const subjectRoutes    = require('./routes/subjectRoutes');
const schoolYearRoutes = require('./routes/schoolYearRoutes');
const gradeRoutes      = require('./routes/gradeRoutes');
const sectionRoutes    = require('./routes/sectionRoutes');
const reportRoutes     = require('./routes/reportRoutes');

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin.includes('netlify.app') || origin.includes('vercel.app'))) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

app.use(express.static(path.join(__dirname, '../')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));
app.get('/health', (req, res) => res.status(200).send('OK'));
app.use('/api/auth',         authRoutes);
app.use('/api/students',     studentRoutes);
app.use('/api/teachers',     teacherRoutes);
app.use('/api/subjects',     subjectRoutes);
app.use('/api/school-years', schoolYearRoutes);
app.use('/api/grades',       gradeRoutes);
app.use('/api/sections',     sectionRoutes);
app.use('/api/reports',      reportRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  console.error(err.stack);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});