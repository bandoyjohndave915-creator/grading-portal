const db = require('../config/db');

// GET all active sections
const getAllSections = (req, res) => {
  db.query(
    'SELECT * FROM sections WHERE is_active = 1 ORDER BY name ASC',
    (err, results) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      res.json(results);
    }
  );
};

// ADD section
const addSection = (req, res) => {
  const { name } = req.body;
  if(!name){
    return res.status(400).json({ message: 'Section name is required' });
  }
  db.query(
    'INSERT INTO sections (name) VALUES (?)',
    [name.trim()],
    (err, result) => {
      if(err){
        if(err.code === 'ER_DUP_ENTRY'){
          return res.status(400).json({ message: 'Section already exists' });
        }
        return res.status(500).json({ message: 'Server error' });
      }
      res.status(201).json({
        message: 'Section added successfully',
        id: result.insertId
      });
    }
  );
};

// DELETE section
const deleteSection = (req, res) => {
  const { id } = req.params;
  db.query(
    'UPDATE sections SET is_active = 0 WHERE id = ?',
    [id],
    (err) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      res.json({ message: 'Section removed successfully' });
    }
  );
};
const getEnrolledSections = (req, res) => {

  // get all unique sections from student_enrollments
  // for the active school year only
  const sql = `
    SELECT DISTINCT se.section
    FROM student_enrollments se
    JOIN school_years sy ON se.school_year_id = sy.id
    WHERE sy.is_active = 1
    ORDER BY se.section ASC
  `;

  db.query(sql, (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    res.json(results.map(r => r.section));
  });

};

module.exports = { getAllSections, addSection, deleteSection, getEnrolledSections };