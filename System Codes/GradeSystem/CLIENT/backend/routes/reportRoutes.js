const express = require('express');
const router  = express.Router();

const {
  getStudentReport,
  getTeacherReport,
  getGradeUploadReport,
  getSchoolYearHistory,
  getReportSummary,
  getSchoolYearRecord
} = require('../controllers/reportController');


const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.get('/summary',      verifyToken, isAdmin, getReportSummary);
router.get('/students',     verifyToken, isAdmin, getStudentReport);
router.get('/teachers',     verifyToken, isAdmin, getTeacherReport);
router.get('/grade-uploads',verifyToken, isAdmin, getGradeUploadReport);
router.get('/school-years', verifyToken, isAdmin, getSchoolYearHistory);
router.get('/school-years/:year_id/record', verifyToken, isAdmin, getSchoolYearRecord);
module.exports = router;