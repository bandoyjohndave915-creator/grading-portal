const express = require('express');
const router = express.Router();
const {
  getAllSchoolYears,
  getActiveSchoolYear,
  addSchoolYear,
  updateActiveQuarter,
  closeSchoolYear,
} = require('../controllers/schoolYearController');

const {
  verifyToken,
  isAdmin
} = require('../middleware/authMiddleware');

router.get('/', verifyToken, getAllSchoolYears);
router.get('/active', verifyToken, getActiveSchoolYear);
router.post('/', verifyToken, isAdmin, addSchoolYear);
router.put('/quarter', verifyToken, isAdmin, updateActiveQuarter);
router.post('/close', verifyToken, isAdmin, closeSchoolYear);

module.exports = router;