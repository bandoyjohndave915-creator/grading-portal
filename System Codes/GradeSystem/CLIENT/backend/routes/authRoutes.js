const express = require('express');
const router = express.Router();

const {
  login,
  activateStudent,
  activateTeacher,
  changeAdminCredentials,
  changePassword
} = require('../controllers/authController');

const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/activate/student', activateStudent);
router.post('/activate/teacher', activateTeacher);
router.put('/change-credentials', verifyToken, isAdmin, changeAdminCredentials);
router.put('/change-password', verifyToken, changePassword);  

module.exports = router;