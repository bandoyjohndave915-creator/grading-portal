const express = require('express');
const router = express.Router();
const {
  getAllSubjects,
  getSubjectsByGrade,
  getArchivedSubjects,
  addSubject,
  updateSubject,
  deleteSubject,
  archiveSubject,
  restoreSubject,
  permanentDeleteSubject,
  bulkArchiveSubjects
} = require('../controllers/subjectController');

const {
  verifyToken,
  isAdmin
} = require('../middleware/authMiddleware');

router.get('/', verifyToken, getAllSubjects);
router.get('/grade/:grade', verifyToken, getSubjectsByGrade);
router.post('/', verifyToken, isAdmin, addSubject);
router.put('/:id', verifyToken, isAdmin, updateSubject);
router.delete('/:id', verifyToken, isAdmin, deleteSubject);
router.put('/:id/archive', verifyToken, isAdmin, archiveSubject);
router.get('/archived',          verifyToken, isAdmin, getArchivedSubjects);
router.put('/:id/restore',       verifyToken, isAdmin, restoreSubject);
router.delete('/:id/permanent',  verifyToken, isAdmin, permanentDeleteSubject);
router.post('/bulk/archive', verifyToken, isAdmin, bulkArchiveSubjects);


module.exports = router;