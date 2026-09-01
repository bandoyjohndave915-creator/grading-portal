const db = require('../config/db');

// ==========================
// GET ALL SUBJECTS
// ==========================

const getAllSubjects = (req, res) => {

const sql = `
  SELECT * FROM subjects
  WHERE is_active = 1
  ORDER BY grade_level, name ASC
`;

  db.query(sql, (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    res.json(results);
  });

};

// ==========================
// GET SUBJECTS BY GRADE
// ==========================

const getSubjectsByGrade = (req, res) => {

  const { grade } = req.params;

  db.query(
    'SELECT * FROM subjects WHERE grade_level = ? ORDER BY name',
    [grade],
    (err, results) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      res.json(results);
    }
  );

};

// ==========================
// ADD SUBJECT
// ==========================

const addSubject = (req, res) => {

  const { name, grade_level, description } = req.body;

  if(!name || !grade_level){
    return res.status(400).json({
      message: 'Subject name and grade level are required'
    });
  }

  db.query(
    'INSERT INTO subjects (name, grade_level, description) VALUES (?, ?, ?)',
    [name, grade_level, description || null],
    (err, result) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      res.status(201).json({
        message: 'Subject added successfully',
        id: result.insertId
      });
    }
  );

};

// ==========================
// UPDATE SUBJECT
// ==========================

const updateSubject = (req, res) => {

  const { id } = req.params;
  const { name, grade_level, description } = req.body;

  db.query(
    'UPDATE subjects SET name = ?, grade_level = ?, description = ? WHERE id = ?',
    [name, grade_level, description, id],
    (err, result) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      if(result.affectedRows === 0){
        return res.status(404).json({ message: 'Subject not found' });
      }
      res.json({ message: 'Subject updated successfully' });
    }
  );

};

// ==========================
// DELETE SUBJECT
// ==========================

const deleteSubject = (req, res) => {

  const { id } = req.params;

  db.query('DELETE FROM subjects WHERE id = ?', [id], (err, result) => {
    if(err){
      // subject is in use — cannot delete
      if(err.code === 'ER_ROW_IS_REFERENCED_2'){
        return res.status(400).json({
          message: 'Cannot delete subject. It is linked to grades or assignments.'
        });
      }
      return res.status(500).json({ message: 'Server error' });
    }
    if(result.affectedRows === 0){
      return res.status(404).json({ message: 'Subject not found' });
    }
    res.json({ message: 'Subject deleted successfully' });
  });

};

// ==========================
// ARCHIVE SUBJECT
// soft delete — preserves data
// ==========================

const archiveSubject = (req, res) => {

  const { id } = req.params;

  db.query(
    'UPDATE subjects SET is_active = 0 WHERE id = ?',
    [id],
    (err, result) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      if(result.affectedRows === 0){
        return res.status(404).json({ message: 'Subject not found' });
      }
      res.json({ message: 'Subject archived successfully' });
    }
  );

};

const getArchivedSubjects = (req, res) => {
  db.query(
    `SELECT * FROM subjects WHERE is_active = 0 ORDER BY name ASC`,
    (err, results) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      res.json(results);
    }
  );
};

const restoreSubject = (req, res) => {
  const { id } = req.params;
  db.query(
    'UPDATE subjects SET is_active = 1 WHERE id = ?',
    [id],
    (err) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      res.json({ message: 'Subject restored successfully' });
    }
  );
};

const permanentDeleteSubject = (req, res) => {
  const { id } = req.params;
  db.query(
    'DELETE FROM subjects WHERE id = ? AND is_active = 0',
    [id],
    (err, result) => {
      if(err){
        if(err.code === 'ER_ROW_IS_REFERENCED_2'){
          return res.status(400).json({
            message: 'Cannot delete — subject has grade records linked to it'
          });
        }
        return res.status(500).json({ message: 'Server error' });
      }
      res.json({ message: 'Subject permanently deleted' });
    }
  );
};

const bulkArchiveSubjects = (req, res) => {
  const { ids, reason } = req.body;
  if(!ids || !Array.isArray(ids) || ids.length === 0){
    return res.status(400).json({ message: 'No subject IDs provided' });
  }
  db.query(
    `UPDATE subjects
     SET is_active      = 0,
         is_archived    = 1,
         archived_at    = NOW(),
         archive_reason = ?
     WHERE id IN (?)`,
    [reason || null, ids],
    (err, result) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      res.json({
        message: `${result.affectedRows} subject(s) archived successfully`
      });
    }
  );
};

module.exports = {
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
};