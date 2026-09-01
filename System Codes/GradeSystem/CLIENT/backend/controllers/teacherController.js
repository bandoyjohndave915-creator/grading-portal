const db = require('../config/db');
const bcrypt = require('bcryptjs');

// ==========================
// GENERATE TEMP PASSWORD
// ==========================

function generateTempPassword(fullName, idNumber) {
  const nameParts = fullName.trim().split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  const firstInitial = firstName[0].toUpperCase();
  const last4 = String(idNumber).slice(-4);
  return `${firstInitial}.${lastName}${last4}`;
}


// ==========================
// GET TEACHER ASSIGNMENTS
// for active school year
// ==========================

const getTeacherAssignments = (req, res) => {

  const { id } = req.params;

  const sql = `
    SELECT
      ta.id,
      ta.grade_level,
      ta.section,
      s.name AS subject_name,
      sy.label AS school_year
    FROM teacher_assignments ta
    JOIN subjects s ON ta.subject_id = s.id
    JOIN school_years sy ON ta.school_year_id = sy.id
    WHERE ta.teacher_id = ?
      AND sy.is_active = 1
    ORDER BY ta.grade_level, ta.section
  `;

  db.query(sql, [id], (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    res.json(results);
  });

};

// ==========================
// ADD TEACHER
// creates user account +
// teacher record
// no assignment yet —
// admin assigns separately
// ==========================

const addTeacher = async (req, res) => {

  const { prc_id, full_name } = req.body;

  if(!prc_id || !full_name){
    return res.status(400).json({
      message: 'PRC ID and full name are required'
    });
  }

  try {

    const tempPassword = generateTempPassword(full_name, prc_id);
    const hashedTemp = await bcrypt.hash(tempPassword, 10);

    const userSql = `
      INSERT INTO users
        (username, password, role, status, temp_password, first_login)
      VALUES (?, ?, 'teacher', 'not_activated', ?, 1)
    `;

    db.query(userSql, [prc_id, hashedTemp, tempPassword], (err, userResult) => {

      if(err){
        if(err.code === 'ER_DUP_ENTRY'){
          return res.status(400).json({ message: 'PRC ID already exists' });
        }
        return res.status(500).json({ message: 'Server error' });
      }

      const userId = userResult.insertId;

      const teacherSql = `
        INSERT INTO teachers (prc_id, full_name, user_id)
        VALUES (?, ?, ?)
      `;

      db.query(teacherSql, [prc_id, full_name, userId], (err2, result) => {
        if(err2) return res.status(500).json({ message: 'Server error' });

        res.status(201).json({
          message: 'Teacher added successfully',
          id: result.insertId,
          temp_password: tempPassword
        });
      });

    });

  } catch(err) {
    res.status(500).json({ message: 'Server error' });
  }

};

// ==========================
// ASSIGN TEACHER
// links teacher to subject,
// grade, section for active year
// ==========================

const assignTeacher = (req, res) => {

  const { teacher_id, subject_id, grade_level, section } = req.body;

  if(!teacher_id || !subject_id || !grade_level || !section){
    return res.status(400).json({ message: 'All fields are required' });
  }

  db.query(
    'SELECT id FROM school_years WHERE is_active = 1 LIMIT 1',
    (err, years) => {

      if(err || years.length === 0){
        return res.status(500).json({
          message: 'No active school year found'
        });
      }

      const schoolYearId = years[0].id;

      const sql = `
        INSERT INTO teacher_assignments
          (teacher_id, subject_id, school_year_id, grade_level, section)
        VALUES (?, ?, ?, ?, ?)
      `;

      db.query(sql,
        [teacher_id, subject_id, schoolYearId, grade_level, section],
        (err2) => {
          if(err2){
            if(err2.code === 'ER_DUP_ENTRY'){
              return res.status(400).json({
                message: 'This assignment already exists'
              });
            }
            return res.status(500).json({ message: 'Server error' });
          }
          res.status(201).json({
            message: 'Teacher assigned successfully'
          });
        }
      );
    }
  );

};

// ==========================
// REMOVE ASSIGNMENT
// removes one assignment only
// teacher account stays intact
// ==========================

const removeAssignment = (req, res) => {

  const { id } = req.params;

  db.query(
    'DELETE FROM teacher_assignments WHERE id = ?',
    [id],
    (err, result) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      if(result.affectedRows === 0){
        return res.status(404).json({ message: 'Assignment not found' });
      }
      res.json({ message: 'Assignment removed successfully' });
    }
  );

};

// ==========================
// DELETE TEACHER
// removes teacher + user account
// only if no grades linked
// ==========================

const deleteTeacher = (req, res) => {

  const { id } = req.params;

  db.query('SELECT user_id FROM teachers WHERE id = ?', [id], (err, results) => {
    if(err || results.length === 0){
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const userId = results[0].user_id;

    // remove assignments first
    db.query(
      'DELETE FROM teacher_assignments WHERE teacher_id = ?',
      [id],
      (err2) => {
        if(err2) return res.status(500).json({ message: 'Server error' });

        db.query('DELETE FROM teachers WHERE id = ?', [id], (err3) => {
          if(err3) return res.status(500).json({ message: 'Server error' });

          db.query('DELETE FROM users WHERE id = ?', [userId], (err4) => {
            if(err4) return res.status(500).json({ message: 'Server error' });
            res.json({ message: 'Teacher deleted successfully' });
          });
        });
      }
    );
  });

};
const archiveTeacher = (req, res) => {

  const { id } = req.params;

  const sql = `
    UPDATE users u
    JOIN teachers t ON t.user_id = u.id
    SET u.status = 'not_activated'
    WHERE t.id = ?
  `;

  db.query(sql, [id], (err, result) => {
    if(err) return res.status(500).json({
      message: 'Server error', error: err.message
    });
    if(result.affectedRows === 0){
      return res.status(404).json({ message: 'Teacher not found' });
    }
    res.json({ message: 'Teacher archived successfully' });
  });

};

// GET all ACTIVE teachers
const getAllTeachers = (req, res) => {

  const sql = `
    SELECT DISTINCT
      t.id,
      t.prc_id,
      t.full_name,
      t.is_archived,
      COALESCE(u.status, 'not_activated') AS status
    FROM teachers t
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.is_archived = 0
    ORDER BY t.full_name ASC
  `;

  db.query(sql, (err, results) => {
    if(err) return res.status(500).json({
      message: 'Server error',
      error: err.message
    });
    res.json(results);
  });

};

// GET all ARCHIVED teachers
const getArchivedTeachers = (req, res) => {

  const sql = `
    SELECT
      t.id,
      t.prc_id,
      t.full_name,
      t.archived_at,
      t.archive_reason,
      COALESCE(u.status, 'not_activated') AS status
    FROM teachers t
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.is_archived = 1
    ORDER BY t.archived_at DESC
  `;

  db.query(sql, (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    res.json(results);
  });

};

const bulkArchiveTeachers = (req, res) => {
  const { ids, reason } = req.body;
  if(!ids || !Array.isArray(ids) || ids.length === 0){
    return res.status(400).json({ message: 'No teacher IDs provided' });
  }
  db.query(
    `UPDATE teachers
     SET is_archived    = 1,
         archived_at    = NOW(),
         archive_reason = ?
     WHERE id IN (?)`,
    [reason || null, ids],
    (err, result) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      res.json({
        message: `${result.affectedRows} teacher(s) archived successfully`
      });
    }
  );
};

// BULK RESTORE teachers
const bulkRestoreTeachers = (req, res) => {
  const { ids } = req.body;
  if(!ids || !Array.isArray(ids) || ids.length === 0){
    return res.status(400).json({ message: 'No teacher IDs provided' });
  }
  db.query(
    'UPDATE teachers SET is_archived = 0, archived_at = NULL WHERE id IN (?)',
    [ids],
    (err, result) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      res.json({ message: `${result.affectedRows} teacher(s) restored successfully` });
    }
  );
};

// BULK PERMANENT DELETE teachers
const bulkDeleteTeachers = (req, res) => {
  const { ids } = req.body;
  if(!ids || !Array.isArray(ids) || ids.length === 0){
    return res.status(400).json({ message: 'No teacher IDs provided' });
  }
  db.query('SELECT user_id FROM teachers WHERE id IN (?)', [ids], (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    const userIds = results.map(r => r.user_id).filter(Boolean);
    db.query('DELETE FROM teacher_assignments WHERE teacher_id IN (?)', [ids], (err2) => {
      if(err2) return res.status(500).json({ message: 'Server error' });
      db.query('DELETE FROM teachers WHERE id IN (?)', [ids], (err3) => {
        if(err3) return res.status(500).json({ message: 'Server error' });
        if(userIds.length > 0){
          db.query('DELETE FROM users WHERE id IN (?)', [userIds], (err4) => {
            if(err4) return res.status(500).json({ message: 'Server error' });
            res.json({ message: `${ids.length} teacher(s) permanently deleted` });
          });
        } else {
          res.json({ message: `${ids.length} teacher(s) permanently deleted` });
        }
      });
    });
  });
};

// ==========================
// GET MY OWN TEACHER RECORD
// for logged-in teacher only
// uses their user_id from token
// ==========================

const getMyTeacherRecord = (req, res) => {

  const userId = req.user.id;

  const sql = `
    SELECT
      t.id,
      t.prc_id,
      t.full_name,
      t.user_id,
      COALESCE(u.status, 'not_activated') AS status,
      u.username
    FROM teachers t
    JOIN users u ON t.user_id = u.id
    WHERE t.user_id = ?
    LIMIT 1
  `;

  db.query(sql, [userId], (err, results) => {
    if(err){
      return res.status(500).json({
        message: 'Server error',
        error: err.message
      });
    }
    if(results.length === 0){
      return res.status(404).json({
        message: 'Teacher record not found. Contact your administrator.'
      });
    }
    res.json(results[0]);
  });

};


// ==========================
// GET MY OWN ASSIGNMENTS
// for logged-in teacher only
// returns only their classes
// for the active school year
// ==========================

const getMyAssignments = (req, res) => {

  const userId = req.user.id;

  const sql = `
    SELECT
      ta.id,
      ta.grade_level,
      ta.section,
      ta.subject_id,
      s.name  AS subject_name,
      sy.label AS school_year,
      sy.id    AS school_year_id
    FROM teacher_assignments ta
    JOIN teachers t ON ta.teacher_id = t.id
    JOIN subjects s ON ta.subject_id = s.id
    JOIN school_years sy ON ta.school_year_id = sy.id
    WHERE t.user_id = ?
      AND sy.is_active = 1
    ORDER BY ta.grade_level, ta.section, s.name ASC
  `;

  db.query(sql, [userId], (err, results) => {
    if(err){
      return res.status(500).json({
        message: 'Server error',
        error: err.message
      });
    }
    res.json(results);
  });

};



module.exports = {
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
};

