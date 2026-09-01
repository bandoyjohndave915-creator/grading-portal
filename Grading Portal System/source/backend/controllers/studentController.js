const db     = require('../config/db');
const bcrypt = require('bcryptjs');

function generateTempPassword(fullName, idNumber) {
  const nameParts    = fullName.trim().split(' ');
  const firstName    = nameParts[0];
  const lastName     = nameParts[nameParts.length - 1];
  const firstInitial = firstName[0].toUpperCase();
  const last4        = String(idNumber).slice(-4);
  return `${firstInitial}.${lastName}${last4}`;
}

const getAllStudents = (req, res) => {

  const sql = `
    SELECT
      s.id,
      s.lrn,
      s.full_name,
      s.is_archived,
      COALESCE(u.status, 'not_activated') AS status,
      se.grade_level,
      se.section,
      se.adviser,
      sy.label AS school_year,
      sy.id    AS school_year_id
    FROM students s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN student_enrollments se ON s.id = se.student_id
    LEFT JOIN school_years sy
      ON se.school_year_id = sy.id
      AND sy.is_active = 1
    WHERE s.is_archived = 0
      AND se.school_year_id = (
        SELECT id FROM school_years WHERE is_active = 1 LIMIT 1
      )
    ORDER BY se.grade_level, se.section, s.full_name ASC
  `;

  db.query(sql, (err, results) => {
    if(err) return res.status(500).json({
      message: 'Server error',
      error: err.message
    });
    res.json(results);
  });

};

// GET all ARCHIVED students
const getArchivedStudents = (req, res) => {

  const sql = `
    SELECT
      s.id,
      s.lrn,
      s.full_name,
      s.archived_at,
      s.archive_reason,
      COALESCE(u.status, 'not_activated') AS status,
      se.grade_level,
      se.section,
      sy.label AS school_year
    FROM students s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN student_enrollments se
      ON se.student_id = s.id
      AND se.id = (
        SELECT id FROM student_enrollments
        WHERE student_id = s.id
        ORDER BY id DESC
        LIMIT 1
      )
    LEFT JOIN school_years sy ON se.school_year_id = sy.id
    WHERE s.is_archived = 1
    ORDER BY s.archived_at DESC
  `;

  db.query(sql, (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    res.json(results);
  });

};

// GET single student
const getStudent = (req, res) => {
  const { id } = req.params;
  db.query(
    'SELECT * FROM students WHERE id = ?',
    [id],
    (err, results) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      if(results.length === 0) return res.status(404).json({ message: 'Student not found' });
      res.json(results[0]);
    }
  );
};

// GET my profile (for logged-in student)
const getMyProfile = (req, res) => {
  const userId = req.user.id;
  const sql = `
    SELECT
      s.lrn, s.full_name,
      u.status,
      se.grade_level, se.section, se.adviser,
      sy.label AS school_year,
      sy.id    AS school_year_id
    FROM students s
    JOIN users u ON s.user_id = u.id
    JOIN student_enrollments se ON s.id = se.student_id
    JOIN school_years sy ON se.school_year_id = sy.id
    WHERE s.user_id = ?
    ORDER BY sy.is_active DESC, sy.id DESC
    LIMIT 1
  `;
  db.query(sql, [userId], (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    if(results.length === 0){
      return res.status(404).json({
        message: 'Profile not found. Contact your administrator.'
      });
    }
    res.json(results[0]);
  });
};

// ADD student
const addStudent = async (req, res) => {
  const { lrn, full_name, grade_level, section, adviser } = req.body;
  if(!lrn || !full_name || !grade_level || !section){
    return res.status(400).json({ message: 'LRN, full name, grade level, and section are required' });
  }
  try {
    const tempPassword = generateTempPassword(full_name, lrn);
    const hashedTemp   = await bcrypt.hash(tempPassword, 10);
    const userSql = `
      INSERT INTO users (username, password, role, status, temp_password, first_login)
      VALUES (?, ?, 'student', 'not_activated', ?, 1)
    `;
    db.query(userSql, [lrn, hashedTemp, tempPassword], (err, userResult) => {
      if(err){
        if(err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'LRN already exists' });
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      const userId = userResult.insertId;
      db.query(
        'INSERT INTO students (lrn, full_name, user_id) VALUES (?, ?, ?)',
        [lrn, full_name, userId],
        (err2, studentResult) => {
          if(err2) return res.status(500).json({ message: 'Server error' });
          const studentId = studentResult.insertId;
          db.query('SELECT id FROM school_years WHERE is_active = 1 LIMIT 1', (err3, years) => {
            if(err3 || years.length === 0){
              return res.status(500).json({ message: 'No active school year found' });
            }
            db.query(
              'INSERT INTO student_enrollments (student_id, school_year_id, grade_level, section, adviser) VALUES (?, ?, ?, ?, ?)',
              [studentId, years[0].id, grade_level, section, adviser || null],
              (err4) => {
                if(err4) return res.status(500).json({ message: 'Server error' });
                res.status(201).json({
                  message: 'Student added successfully',
                  id: studentId,
                  temp_password: tempPassword
                });
              }
            );
          });
        }
      );
    });
  } catch(err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// UPDATE student
const updateStudent = (req, res) => {
  const { id } = req.params;
  const { full_name, grade_level, section, adviser } = req.body;
  db.query('UPDATE students SET full_name = ? WHERE id = ?', [full_name, id], (err) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    const sql = `
      UPDATE student_enrollments se
      JOIN school_years sy ON se.school_year_id = sy.id
      SET se.grade_level = ?, se.section = ?, se.adviser = ?
      WHERE se.student_id = ? AND sy.is_active = 1
    `;
    db.query(sql, [grade_level, section, adviser, id], (err2) => {
      if(err2) return res.status(500).json({ message: 'Server error' });
      res.json({ message: 'Student updated successfully' });
    });
  });
};

const bulkArchiveStudents = (req, res) => {
  const { ids, reason } = req.body;
  if(!ids || !Array.isArray(ids) || ids.length === 0){
    return res.status(400).json({ message: 'No student IDs provided' });
  }
  const sql = `
    UPDATE students
    SET is_archived    = 1,
        archived_at    = NOW(),
        archive_reason = ?
    WHERE id IN (?)
  `;
  db.query(sql, [reason || null, ids], (err, result) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    res.json({
      message: `${result.affectedRows} student(s) archived successfully`
    });
  });
};

// BULK RESTORE students
const bulkRestoreStudents = (req, res) => {
  const { ids } = req.body;
  if(!ids || !Array.isArray(ids) || ids.length === 0){
    return res.status(400).json({ message: 'No student IDs provided' });
  }
  const sql = `
    UPDATE students
    SET is_archived = 0, archived_at = NULL
    WHERE id IN (?)
  `;
  db.query(sql, [ids], (err, result) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    res.json({
      message: `${result.affectedRows} student(s) restored successfully`
    });
  });
};

// BULK PERMANENT DELETE students
const bulkDeleteStudents = (req, res) => {
  const { ids } = req.body;
  if(!ids || !Array.isArray(ids) || ids.length === 0){
    return res.status(400).json({ message: 'No student IDs provided' });
  }
  // get user_ids first
  db.query('SELECT user_id FROM students WHERE id IN (?)', [ids], (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    const userIds = results.map(r => r.user_id).filter(Boolean);
    // delete enrollments
    db.query('DELETE FROM student_enrollments WHERE student_id IN (?)', [ids], (err2) => {
      if(err2) return res.status(500).json({ message: 'Server error' });
      // delete students
      db.query('DELETE FROM students WHERE id IN (?)', [ids], (err3) => {
        if(err3) return res.status(500).json({ message: 'Server error' });
        // delete user accounts if any
        if(userIds.length > 0){
          db.query('DELETE FROM users WHERE id IN (?)', [userIds], (err4) => {
            if(err4) return res.status(500).json({ message: 'Server error' });
            res.json({ message: `${ids.length} student(s) permanently deleted` });
          });
        } else {
          res.json({ message: `${ids.length} student(s) permanently deleted` });
        }
      });
    });
  });
};

// legacy single archive (kept for compatibility)
const archiveStudent = (req, res) => {
  const { id } = req.params;
  db.query(
    'UPDATE students SET is_archived = 1, archived_at = NOW() WHERE id = ?',
    [id],
    (err) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      res.json({ message: 'Student archived successfully' });
    }
  );
};

// legacy delete (kept for compatibility)
const deleteStudent = (req, res) => {
  res.status(400).json({
    message: 'Use bulk archive or bulk delete instead'
  });
};

const getStudentsByClass = (req, res) => {

  const { grade_level, section } = req.query;

  if(!grade_level || !section){
    return res.status(400).json({
      message: 'grade_level and section are required'
    });
  }

  const sql = `
    SELECT
      s.id,
      s.lrn,
      s.full_name,
      se.grade_level,
      se.section
    FROM students s
    JOIN student_enrollments se ON s.id = se.student_id
    JOIN school_years sy ON se.school_year_id = sy.id
    WHERE se.grade_level = ?
      AND se.section     = ?
      AND sy.is_active   = 1
      AND s.is_archived  = 0
    ORDER BY s.full_name ASC
  `;

  db.query(sql, [grade_level, section], (err, results) => {
    if(err) return res.status(500).json({
      message: 'Server error',
      error: err.message
    });
    res.json(results);
  });

};

module.exports = {
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
};