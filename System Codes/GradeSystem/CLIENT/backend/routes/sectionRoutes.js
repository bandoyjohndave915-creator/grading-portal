const express = require('express');
const router  = express.Router();
const {
  getAllSections,
  addSection,
  deleteSection,
  getEnrolledSections
} = require('../controllers/sectionController');

const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.get('/',     verifyToken, getAllSections);
router.post('/',    verifyToken, isAdmin, addSection);
router.delete('/:id', verifyToken, isAdmin, deleteSection);
router.get('/enrolled', verifyToken, getEnrolledSections);

module.exports = router;