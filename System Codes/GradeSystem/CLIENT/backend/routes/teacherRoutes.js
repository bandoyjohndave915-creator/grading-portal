const express = require('express');
const router  = express.Router();

const {
  getAllTeachers,
  getArchivedTeachers,
  getMyTeacherRecord,
  getMyAssignments,
  getTeacherAssignments,
  addTeacher,
  assignTeacher,
  removeAssignment,
  deleteTeacher,
  archiveTeacher,
  bulkArchiveTeachers,
  bulkRestoreTeachers,
  bulkDeleteTeachers
} = require('../controllers/teacherController');

const {
  verifyToken,
  isAdmin,
  isTeacher
} = require('../middleware/authMiddleware');

// ==============================
// TEACHER'S OWN ROUTES
// accessible by logged-in teacher
// no admin required
// ==============================
router.get(  '/my-record',  verifyToken,  isTeacher,  getMyTeacherRecord);
router.get(  '/my-assignments',  verifyToken,  isTeacher,  getMyAssignments);


// ==============================
// ADMIN ROUTES
// accessible by admin only
// ==============================

router.get(  '/',  verifyToken,  isAdmin,getAllTeachers);
router.get(  '/archived',  verifyToken,isAdmin,  getArchivedTeachers);
router.get(  '/:id/assignments',  verifyToken,  isAdmin,  getTeacherAssignments);
router.post(  '/',  verifyToken,  isAdmin,  addTeacher);
router.post(  '/assign', verifyToken, isAdmin,  assignTeacher);
router.delete(  '/assignment/:id', verifyToken,  isAdmin,  removeAssignment);
router.put( '/:id/archive',  verifyToken, isAdmin,  archiveTeacher);
router.delete(  '/:id', verifyToken,  isAdmin,  deleteTeacher);
router.post('/bulk/archive', verifyToken,  isAdmin,  bulkArchiveTeachers);
router.post( '/bulk/restore',  verifyToken,  isAdmin, bulkRestoreTeachers);
router.post(  '/bulk/delete',  verifyToken,  isAdmin,  bulkDeleteTeachers);

module.exports = router;