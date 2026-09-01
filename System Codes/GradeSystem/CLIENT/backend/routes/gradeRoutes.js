const express = require('express');
const router  = express.Router();

const {
  upload,
  getAllUploads,
  getUploadCounts,
  getUploadDetails,
  getUploadSubjects,
  getUploadSections,
  uploadGrades,
  approveUpload,
  rejectUpload,
  lockUpload,
  unapproveUpload,
  getTeacherUploads,
  getTeacherGradeRecords,
  getStudentGrades,
  previewGrades,
  generateGradeTemplate,
  exportTeacherGrades
} = require('../controllers/gradeController');

const {
  verifyToken,
  isAdmin,
  isTeacher,
  isStudent,
  isTeacherOrAdmin
} = require('../middleware/authMiddleware');

// ── TEACHER ROUTES
router.get('/my-uploads',       verifyToken, isTeacherOrAdmin, getTeacherUploads);
router.get('/my-grade-records', verifyToken, isTeacherOrAdmin, getTeacherGradeRecords);
router.get('/my-grades',        verifyToken, isStudent,        getStudentGrades);
router.get('/template',         verifyToken, isTeacherOrAdmin, generateGradeTemplate);
router.get('/export',           verifyToken, isTeacherOrAdmin, exportTeacherGrades);

router.post('/preview', verifyToken, isTeacherOrAdmin, upload.single('gradeFile'), previewGrades);
router.post('/upload',  verifyToken, isTeacherOrAdmin, upload.single('gradeFile'), uploadGrades);

// ── ADMIN SPECIFIC NAMED ROUTES — must come before /uploads/:id
router.get('/uploads/counts',   verifyToken, isAdmin, getUploadCounts);
router.get('/uploads/subjects', verifyToken, isAdmin, getUploadSubjects);
router.get('/uploads/sections', verifyToken, isAdmin, getUploadSections);

// ── ADMIN UPLOAD MANAGEMENT
router.get('/uploads',            verifyToken, isAdmin, getAllUploads);
router.get('/uploads/:id',        verifyToken, isAdmin, getUploadDetails);
router.put('/uploads/:id/approve',  verifyToken, isAdmin, approveUpload);
router.put('/uploads/:id/reject',   verifyToken, isAdmin, rejectUpload);
router.put('/uploads/:id/lock',     verifyToken, isAdmin, lockUpload);
router.put('/uploads/:id/unapprove',verifyToken, isAdmin, unapproveUpload);


module.exports = router;