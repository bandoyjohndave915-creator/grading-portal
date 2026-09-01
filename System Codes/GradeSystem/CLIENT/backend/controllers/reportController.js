const db = require('../config/db');

// ==========================
// STUDENT REPORT
// shows all students with
// enrollment info per school year
// ==========================

const getStudentReport = (req, res) => {

  const { school_year_id, grade_level, section } = req.query;

  let sql = `
    SELECT
      s.id,
      s.lrn,
      s.full_name,
      se.grade_level,
      se.section,
      se.adviser,
      sy.label      AS school_year,
      u.status      AS account_status,
      s.is_archived
    FROM students s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN student_enrollments se ON s.id = se.student_id
    LEFT JOIN school_years sy ON se.school_year_id = sy.id
    WHERE 1=1
  `;

  const params = [];

  if(school_year_id){
    sql += ' AND sy.id = ?';
    params.push(school_year_id);
  }

  if(grade_level){
    sql += ' AND se.grade_level = ?';
    params.push(grade_level);
  }

  if(section){
    sql += ' AND se.section = ?';
    params.push(section);
  }

  sql += ' ORDER BY sy.label DESC, se.grade_level, se.section, s.full_name ASC';

  db.query(sql, params, (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error', error: err.message });
    res.json(results);
  });

};


// ==========================
// TEACHER REPORT
// shows all teachers with
// their assignments
// ==========================

const getTeacherReport = (req, res) => {

  const { school_year_id } = req.query;

  let sql = `
    SELECT
      t.id,
      t.prc_id,
      t.full_name,
      u.status      AS account_status,
      t.is_archived,
      ta.grade_level,
      ta.section,
      s.name        AS subject_name,
      sy.label      AS school_year
    FROM teachers t
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN teacher_assignments ta ON t.id = ta.teacher_id
    LEFT JOIN subjects s ON ta.subject_id = s.id
    LEFT JOIN school_years sy ON ta.school_year_id = sy.id
    WHERE 1=1
  `;

  const params = [];

  if(school_year_id){
    sql += ' AND (sy.id = ? OR sy.id IS NULL)';
    params.push(school_year_id);
  }

  sql += ' ORDER BY t.full_name ASC, sy.label DESC';

  db.query(sql, params, (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error', error: err.message });
    res.json(results);
  });

};


// ==========================
// GRADE UPLOAD REPORT
// shows all uploads with
// approval status summary
// ==========================

const getGradeUploadReport = (req, res) => {

  const { school_year_id, quarter, status } = req.query;

  let sql = `
    SELECT
      u.id,
      u.grade_level,
      u.section,
      u.quarter,
      u.status,
      u.submitted_at,
      u.reviewed_at,
      t.full_name  AS teacher_name,
      t.prc_id,
      s.name       AS subject_name,
      sy.label     AS school_year,
      (
        SELECT COUNT(*)
        FROM grades g
        WHERE g.upload_id = u.id
      ) AS total_students,
      (
        SELECT COUNT(*)
        FROM grades g
        WHERE g.upload_id = u.id
          AND g.score >= 75
      ) AS passing,
      (
        SELECT COUNT(*)
        FROM grades g
        WHERE g.upload_id = u.id
          AND g.score < 75
      ) AS failing
    FROM uploads u
    JOIN teachers     t  ON u.teacher_id     = t.id
    JOIN subjects     s  ON u.subject_id     = s.id
    JOIN school_years sy ON u.school_year_id = sy.id
    WHERE 1=1
  `;

  const params = [];

  if(school_year_id){
    sql += ' AND sy.id = ?';
    params.push(school_year_id);
  }

  if(quarter){
    sql += ' AND u.quarter = ?';
    params.push(quarter);
  }

  if(status){
    sql += ' AND u.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY sy.label DESC, u.submitted_at DESC';

  db.query(sql, params, (err, results) => {
    if(err) return res.status(500).json({
      message: 'Server error',
      error: err.message
    });
    res.json(results);
  });

};


// ==========================
// SCHOOL YEAR HISTORY
// shows summary per school year
// ==========================

const getSchoolYearHistory = (req, res) => {

  const sql = `
    SELECT
      sy.id,
      sy.label,
      sy.is_active,
      sy.created_at,
      qc.total_quarters,
      qc.active_quarter,
      (
        SELECT COUNT(DISTINCT se.student_id)
        FROM student_enrollments se
        WHERE se.school_year_id = sy.id
      ) AS total_students,
      (
        SELECT COUNT(DISTINCT ta.teacher_id)
        FROM teacher_assignments ta
        WHERE ta.school_year_id = sy.id
      ) AS total_teachers,
      (
        SELECT COUNT(*)
        FROM uploads u
        WHERE u.school_year_id = sy.id
      ) AS total_uploads,
      (
        SELECT COUNT(*)
        FROM uploads u
        WHERE u.school_year_id = sy.id
          AND u.status = 'approved'
      ) AS approved_uploads,
      (
        SELECT COUNT(*)
        FROM uploads u
        WHERE u.school_year_id = sy.id
          AND u.status = 'pending'
      ) AS pending_uploads,
      (
        SELECT COUNT(*)
        FROM uploads u
        WHERE u.school_year_id = sy.id
          AND u.status = 'locked'
      ) AS locked_uploads
    FROM school_years sy
    LEFT JOIN quarters_config qc ON qc.school_year_id = sy.id
    ORDER BY sy.created_at DESC
  `;

  db.query(sql, (err, results) => {
    if(err) return res.status(500).json({
      message: 'Server error',
      error: err.message
    });
    res.json(results);
  });

};


// ==========================
// REPORT SUMMARY COUNTS
// for the report section cards
// ==========================

const getReportSummary = (req, res) => {

  const sql = `
    SELECT
      (
        SELECT COUNT(DISTINCT se.student_id)
        FROM student_enrollments se
        JOIN school_years sy ON se.school_year_id = sy.id
        WHERE sy.is_active = 1
      ) AS total_students,
      (
        SELECT COUNT(DISTINCT ta.teacher_id)
        FROM teacher_assignments ta
        JOIN school_years sy ON ta.school_year_id = sy.id
        WHERE sy.is_active = 1
      ) AS total_teachers,
      (
        SELECT COUNT(*)
        FROM uploads u
        JOIN school_years sy ON u.school_year_id = sy.id
        WHERE u.status = 'approved'
          AND sy.is_active = 1
      ) AS approved_uploads,
      (
        SELECT COUNT(*)
        FROM uploads u
        JOIN school_years sy ON u.school_year_id = sy.id
        WHERE u.status = 'pending'
          AND sy.is_active = 1
      ) AS pending_uploads,
      (
        SELECT label
        FROM school_years
        WHERE is_active = 1
        LIMIT 1
      ) AS active_school_year
  `;

  db.query(sql, (err, results) => {
    if(err) return res.status(500).json({
      message: 'Server error',
      error: err.message
    });
    res.json(results[0]);
  });

};

// ==========================
// for the archive
// ==========================

// get full record of a specific school year
const getSchoolYearRecord = (req, res) => {

  const { year_id } = req.params;
  const { type }    = req.query;
  // type = students | teachers | grades | uploads

  if(type === 'students'){

    const sql = `
      SELECT
        s.lrn,
        s.full_name,
        se.grade_level,
        se.section,
        se.adviser,
        COALESCE(u.status, 'not_activated') AS account_status
      FROM students s
      JOIN student_enrollments se ON s.id = se.student_id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE se.school_year_id = ?
      ORDER BY se.grade_level, se.section, s.full_name ASC
    `;

    db.query(sql, [year_id], (err, results) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      res.json(results);
    });

  } else if(type === 'teachers'){

    const sql = `
      SELECT DISTINCT
        t.prc_id,
        t.full_name,
        s.name        AS subject_name,
        ta.grade_level,
        ta.section,
        COALESCE(u.status, 'not_activated') AS account_status
      FROM teachers t
      JOIN teacher_assignments ta ON t.id = ta.teacher_id
      JOIN subjects s ON ta.subject_id = s.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE ta.school_year_id = ?
      ORDER BY t.full_name, s.name ASC
    `;

    db.query(sql, [year_id], (err, results) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      res.json(results);
    });

  } else if(type === 'uploads'){

    const sql = `
      SELECT
        u.id,
        u.quarter,
        u.grade_level,
        u.section,
        u.status,
        u.submitted_at,
        t.full_name   AS teacher_name,
        s.name        AS subject_name,
        COUNT(g.id)   AS total_students,
        SUM(CASE WHEN g.score >= 75 THEN 1 ELSE 0 END) AS passing,
        SUM(CASE WHEN g.score <  75 THEN 1 ELSE 0 END) AS failing
      FROM uploads u
      JOIN teachers t ON u.teacher_id = t.id
      JOIN subjects s ON u.subject_id = s.id
      LEFT JOIN grades g ON g.upload_id = u.id
      WHERE u.school_year_id = ?
      GROUP BY u.id, u.quarter, u.grade_level, u.section,
               u.status, u.submitted_at,
               t.full_name, s.name
      ORDER BY u.submitted_at DESC
    `;

    db.query(sql, [year_id], (err, results) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      res.json(results);
    });

  } else if(type === 'grades'){

    const sql = `
      SELECT
        st.lrn,
        st.full_name  AS student_name,
        se.grade_level,
        se.section,
        s.name        AS subject_name,
        g.quarter,
        g.score,
        g.status
      FROM grades g
      JOIN students st ON g.student_id = st.id
      JOIN subjects s  ON g.subject_id = s.id
      JOIN student_enrollments se
        ON se.student_id = st.id
        AND se.school_year_id = ?
      WHERE g.school_year_id = ?
      ORDER BY se.grade_level, se.section, st.full_name, s.name ASC
    `;

    db.query(sql, [year_id, year_id], (err, results) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      res.json(results);
    });

//summary query

  } else {

  const sql = `
    SELECT
      sy.id,
      sy.label,
      sy.is_active,
      sy.created_at,
      (
        SELECT COUNT(DISTINCT se.student_id)
        FROM student_enrollments se
        WHERE se.school_year_id = sy.id
      ) AS total_students,
      (
        SELECT COUNT(DISTINCT ta.teacher_id)
        FROM teacher_assignments ta
        WHERE ta.school_year_id = sy.id
      ) AS total_teachers,
      (
        SELECT COUNT(*)
        FROM uploads u
        WHERE u.school_year_id = sy.id
      ) AS total_uploads,
      (
        SELECT COUNT(*)
        FROM uploads u
        WHERE u.school_year_id = sy.id
          AND u.status = 'approved'
      ) AS approved,
      (
        SELECT COUNT(*)
        FROM uploads u
        WHERE u.school_year_id = sy.id
          AND u.status = 'locked'
      ) AS locked
    FROM school_years sy
    WHERE sy.id = ?
  `;

  db.query(sql, [year_id], (err, results) => {
    if(err) return res.status(500).json({
      message: 'Server error'
    });
    if(results.length === 0){
      return res.status(404).json({
        message: 'School year not found'
      });
    }
    res.json(results[0]);
  });
}

};

module.exports = {
  getStudentReport,
  getTeacherReport,
  getGradeUploadReport,
  getSchoolYearHistory,
  getReportSummary,
  getSchoolYearRecord
};