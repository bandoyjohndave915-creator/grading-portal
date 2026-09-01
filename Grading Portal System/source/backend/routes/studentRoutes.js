const express = require('express');
const router  = express.Router();

const {
  getAllStudents,
  getArchivedStudents,
  getStudent,
  getMyProfile,
  getStudentsByClass,
  addStudent,
  updateStudent,
  deleteStudent,
  archiveStudent,
  bulkArchiveStudents,
  bulkRestoreStudents,
  bulkDeleteStudents
} = require('../controllers/studentController');

const {  importUpload,  importStudentsFromExcel} = require('../controllers/studentImportController');
const {  verifyToken,  isAdmin} = require('../middleware/authMiddleware');

// ── SPECIFIC NAMED ROUTES FIRST
// these must come before /:id or Express will
// treat 'archived', 'by-class', 'my-profile'
// as ID parameters and route to getStudent
router.get(  '/archived',  verifyToken,  isAdmin,  getArchivedStudents);
router.get(  '/my-profile',  verifyToken,  getMyProfile);

// accessible by any logged-in user (teacher or admin)
// no isAdmin — teachers need this to view their class lists
router.get(  '/by-class',  verifyToken,  getStudentsByClass);

// ── BULK ACTIONS
router.post(  '/bulk/archive',  verifyToken,  isAdmin,  bulkArchiveStudents);
router.post(  '/bulk/restore',  verifyToken,  isAdmin,  bulkRestoreStudents);
router.post(  '/bulk/delete',  verifyToken,  isAdmin,  bulkDeleteStudents);

// ── EXCEL IMPORT
router.post(  '/import',  verifyToken,  isAdmin,  importUpload.single('studentFile'),  importStudentsFromExcel);

// ── GENERAL CRUD
// /:id routes LAST so named routes above are matched first
router.get(  '/',  verifyToken,  isAdmin,  getAllStudents);
router.get(  '/:id',  verifyToken,  isAdmin,  getStudent);
router.post(  '/',  verifyToken,  isAdmin,  addStudent);
router.put(  '/:id',  verifyToken,  isAdmin,  updateStudent);
router.delete(  '/:id',  verifyToken,  isAdmin,  deleteStudent);
router.put(  '/:id/archive',  verifyToken,  isAdmin,  archiveStudent);

module.exports = router;