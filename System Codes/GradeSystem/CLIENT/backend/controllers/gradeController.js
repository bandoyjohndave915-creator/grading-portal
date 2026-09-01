const db = require('../config/db');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// ==========================
// MULTER STORAGE CONFIG
// saves uploaded excel files
// ==========================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/excel-files');
    if(!fs.existsSync(uploadPath)){
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `grades_${timestamp}_${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if(!allowed.includes(ext)){
      return cb(new Error('Only Excel files are allowed'));
    }
    cb(null, true);
  }
});

// ==========================
// GET ALL UPLOADS
// for admin — all uploads
// with teacher and subject info
// ==========================

const getAllUploads = (req, res) => {

  const sql = `
    SELECT
      u.id,
      u.grade_level,
      u.section,
      u.quarter,
      u.status,
      u.remarks,
      u.teacher_note,
      u.submitted_at,
      u.reviewed_at,
      t.full_name   AS teacher_name,
      t.prc_id,
      s.name        AS subject_name,
      s.id          AS subject_id,
      sy.label      AS school_year,
      sy.id         AS school_year_id
    FROM uploads u
    JOIN teachers     t  ON u.teacher_id     = t.id
    JOIN subjects     s  ON u.subject_id     = s.id
    JOIN school_years sy ON u.school_year_id = sy.id
    WHERE sy.is_active = 1
    ORDER BY u.submitted_at DESC
  `;

  db.query(sql, (err, results) => {
    if(err) return res.status(500).json({
      message: 'Server error',
      error: err.message
    });
    res.json(results);
  });

};

const getUploadSubjects = (req, res) => {
  const sql = `
    SELECT DISTINCT s.id, s.name
    FROM uploads u
    JOIN subjects s ON u.subject_id = s.id
    JOIN school_years sy ON u.school_year_id = sy.id
    WHERE sy.is_active = 1
    ORDER BY s.name ASC
  `;
  db.query(sql, (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    res.json(results);
  });
};

const getUploadSections = (req, res) => {

  const sql = `
    SELECT DISTINCT u.section
    FROM uploads u
    JOIN school_years sy ON u.school_year_id = sy.id
    WHERE sy.is_active = 1
    ORDER BY u.section ASC
  `;

  db.query(sql, (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    res.json(results.map(r => r.section));
  });

};

// ==========================
// GET UPLOAD COUNTS
// for admin dashboard cards
// ==========================

const getUploadCounts = (req, res) => {

  const sql = `
    SELECT
      COUNT(*)                                          AS total,
      SUM(CASE WHEN u.status = 'pending'  THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN u.status = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN u.status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
      SUM(CASE WHEN u.status = 'locked'   THEN 1 ELSE 0 END) AS locked
    FROM uploads u
    JOIN school_years sy ON u.school_year_id = sy.id
    WHERE sy.is_active = 1
  `;

  db.query(sql, (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    res.json(results[0]);
  });

};

// ==========================
// GET SINGLE UPLOAD + GRADES
// for admin review modal
// ==========================

const getUploadDetails = (req, res) => {

  const { id } = req.params;

  // first get the upload record
const uploadSql = `
  SELECT
    u.id,
    u.grade_level,
    u.section,
    u.quarter,
    u.status,
    u.remarks,
    u.file_path,
    u.submitted_at,
    u.reviewed_at,
    t.full_name    AS teacher_name,
    t.prc_id,
    s.name         AS subject_name,
    sy.label       AS school_year
  FROM uploads u
  JOIN teachers     t  ON u.teacher_id     = t.id
  JOIN subjects     s  ON u.subject_id     = s.id
  JOIN school_years sy ON u.school_year_id = sy.id
  WHERE u.id = ?
`;

  db.query(uploadSql, [id], (err, uploadResult) => {

    if(err){
      console.error('Upload query error:', err.message);
      return res.status(500).json({
        message: 'Server error fetching upload',
        error: err.message
      });
    }

    if(!uploadResult || uploadResult.length === 0){
      return res.status(404).json({ message: 'Upload not found' });
    }

    const upload = uploadResult[0];

    // then get grades for this upload
    const gradesSql = `
      SELECT
        g.id,
        g.score,
        g.status,
        g.quarter,
        st.lrn,
        st.full_name AS student_name
      FROM grades g
      JOIN students st ON g.student_id = st.id
      WHERE g.upload_id = ?
      ORDER BY st.full_name ASC
    `;

    db.query(gradesSql, [id], (err2, grades) => {

      if(err2){
        console.error('Grades query error:', err2.message);
        return res.status(500).json({
          message: 'Server error fetching grades',
          error: err2.message
        });
      }

      // grades might be empty for orphaned uploads — still return upload info
      const gradeList = grades || [];

      res.json({
        upload:  upload,
        grades:  gradeList,
        total:   gradeList.length,
        passing: gradeList.filter(g => parseFloat(g.score) >= 75).length,
        failing: gradeList.filter(g => parseFloat(g.score) < 75).length
      });
    });
  });
};

// ==========================
// UNAPPROVE UPLOAD
// returns approved grades back
// to pending so admin can fix
// a mistake or wait for updates
// ==========================

const unapproveUpload = (req, res) => {

  const { id } = req.params;

  db.query(
    'SELECT status FROM uploads WHERE id = ?',
    [id],
    (err, results) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      if(results.length === 0){
        return res.status(404).json({ message: 'Upload not found' });
      }

      const currentStatus = results[0].status;

      if(currentStatus === 'locked'){
        return res.status(400).json({
          message: 'Locked uploads cannot be changed.'
        });
      }

      if(currentStatus === 'pending'){
        return res.status(400).json({
          message: 'Upload is already pending.'
        });
      }

      // set grades back to pending
      db.query(
        `UPDATE grades SET status = 'pending' WHERE upload_id = ?`,
        [id],
        (err2) => {
          if(err2) return res.status(500).json({ message: 'Server error' });

          // set upload back to pending and clear remarks
          db.query(
            `UPDATE uploads
             SET status      = 'pending',
                 remarks     = NULL,
                 reviewed_at = NULL
             WHERE id = ?`,
            [id],
            (err3) => {
              if(err3) return res.status(500).json({ message: 'Server error' });
              res.json({
                message: 'Upload returned to pending.'
              });
            }
          );
        }
      );
    }
  );
};

// ==========================
// TEACHER UPLOAD GRADES
// reads excel file, validates,
// saves upload + grade records
// ==========================

const uploadGrades = (req, res) => {

  const { subject_id, grade_level, section, quarter } = req.body;
  const teacherUserId = req.user.id;

  if(!subject_id || !grade_level || !section || !quarter){
    return res.status(400).json({
      message: 'Subject, grade level, section and quarter are required'
    });
  }

  if(!req.file){
    return res.status(400).json({ message: 'Excel file is required' });
  }

  // ── read excel file
  let worksheet;
  try {
    const workbook  = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    worksheet       = workbook.Sheets[sheetName];
  } catch(e) {
    return res.status(400).json({
      message: 'Could not read Excel file. Use the downloaded template.'
    });
  }

  // ── find LRN and Final Grade columns by scanning header row
  const wsRange = xlsx.utils.decode_range(worksheet['!ref'] || 'A1');
  let headerRowIdx = -1;
  let lrnColIdx    = -1;
  let gradeColIdx  = -1;

  for(let r = 0; r <= Math.min(wsRange.e.r, 20); r++){
    for(let c = 0; c <= wsRange.e.c; c++){
      const ref  = xlsx.utils.encode_cell({ r, c });
      const cell = worksheet[ref];
      if(!cell) continue;
      const val = String(cell.v || '').trim().toUpperCase();
      if(val === 'LRN'){ headerRowIdx = r; lrnColIdx = c; }
      if(val === 'FINAL GRADE' || val === 'SCORE') gradeColIdx = c;
    }
    if(headerRowIdx !== -1 && gradeColIdx !== -1) break;
  }

  if(headerRowIdx === -1 || lrnColIdx === -1){
    return res.status(400).json({
      message: 'Could not find LRN column. Use the downloaded template.'
    });
  }

  if(gradeColIdx === -1){
    return res.status(400).json({
      message: 'Could not find Final Grade column. Fill in grades before uploading.'
    });
  }

  // ── extract student rows below the header
  const dataRows = [];
      // stop at row 109 (index 108) — row 111 is instructions in col D
    const lastDataRow = Math.min(wsRange.e.r, 108);
    for(let r = headerRowIdx + 1; r <= lastDataRow; r++){
    const lrnCell   = worksheet[xlsx.utils.encode_cell({ r, c: lrnColIdx })];
    const gradeCell = worksheet[xlsx.utils.encode_cell({ r, c: gradeColIdx })];
    const lrn       = lrnCell   ? String(lrnCell.v   || '').trim() : '';
    const score     = gradeCell ? parseFloat(gradeCell.v)          : NaN;
    if(!lrn) continue;
    dataRows.push({ lrn, score });
  }

  if(dataRows.length === 0){
    return res.status(400).json({
      message: 'No student data found in the file.'
    });
  }

  // ── validate all scores before doing anything
  const scoreErrors = [];
  dataRows.forEach((row, i) => {
    if(isNaN(row.score) || row.score < 0 || row.score > 100){
      scoreErrors.push(
        `Row ${headerRowIdx + i + 2}: ` +
        `Invalid grade "${row.score}" for LRN ${row.lrn}`
      );
    }
  });

  if(scoreErrors.length > 0){
    return res.status(400).json({
      message: 'Validation errors found in file',
      errors: scoreErrors
    });
  }

  // ── main async flow
  const runUpload = async () => {

    // get active school year
    const [years] = await db.promise().query(
      'SELECT id FROM school_years WHERE is_active = 1 LIMIT 1'
    );
    if(years.length === 0){
      throw new Error('No active school year found. Set one in Settings.');
    }
    const schoolYearId = years[0].id;

    // get teacher db record from user id
    const [teachers] = await db.promise().query(
      'SELECT id FROM teachers WHERE user_id = ?',
      [teacherUserId]
    );
    if(teachers.length === 0){
      throw new Error('Teacher record not found.');
    }
    const dbTeacherId = teachers[0].id;

    // ── check for existing upload for same batch
    const [existing] = await db.promise().query(
      `SELECT id, status
       FROM uploads
       WHERE teacher_id     = ?
         AND subject_id     = ?
         AND grade_level    = ?
         AND section        = ?
         AND quarter        = ?
         AND school_year_id = ?`,
      [dbTeacherId, subject_id, grade_level, section, quarter, schoolYearId]
    );

    let uploadId    = null;
    let resubmitted = false;

    if(existing.length > 0){

      const existingStatus = existing[0].status;
      const existingId     = existing[0].id;

      // block if approved or locked
      if(existingStatus === 'approved'){
        throw new Error(
          'Grades for this subject and quarter are already approved. ' +
          'Contact the admin if corrections are needed.'
        );
      }

      if(existingStatus === 'locked'){
        throw new Error(
          'Grades for this subject and quarter are locked and finalized. ' +
          'No further changes are allowed.'
        );
      }

      if(existingStatus === 'pending'){
        throw new Error(
          'A grade upload is already pending review. ' +
          'Wait for the admin to approve or reject it before resubmitting.'
        );
      }

      // ── RESUBMIT — status is 'rejected'
      // delete old grades and update the upload record
      await db.promise().query(
        'DELETE FROM grades WHERE upload_id = ?',
        [existingId]
      );

      // fix: use ? for every value — no hardcoded NULL
      await db.promise().query(
        `UPDATE uploads
         SET file_path    = ?,
             status       = ?,
             remarks      = ?,
             reviewed_at  = ?,
             submitted_at = NOW()
         WHERE id = ?`,
        [req.file.filename, 'pending', null, null, existingId]
      );

      uploadId    = existingId;
      resubmitted = true;

    } else {

      // ── NEW UPLOAD — create upload record
      const [uploadResult] = await db.promise().query(
        `INSERT INTO uploads
           (teacher_id, subject_id, school_year_id,
            grade_level, section, quarter, file_path, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dbTeacherId,
          subject_id,
          schoolYearId,
          grade_level,
          section,
          quarter,
          req.file.filename,
          'pending'
        ]
      );

      uploadId = uploadResult.insertId;
    }

    // ── match LRNs to students and build grade inserts
    const gradeInserts = [];
    const notFound     = [];

    for(const row of dataRows){
      const [studentResult] = await db.promise().query(
        'SELECT id FROM students WHERE lrn = ?',
        [row.lrn]
      );
      if(studentResult.length === 0){
        notFound.push(row.lrn);
      } else {
        gradeInserts.push([
          studentResult[0].id,
          subject_id,
          dbTeacherId,
          uploadId,
          schoolYearId,
          quarter,
          row.score,
          'pending'
        ]);
      }
    }

    if(gradeInserts.length === 0){
      // clean up the upload record if no students matched
      if(!resubmitted){
        await db.promise().query(
          'DELETE FROM uploads WHERE id = ?',
          [uploadId]
        );
      }
      throw new Error(
        `No matching students found in the system. ` +
        `LRNs not found: ${notFound.join(', ')}`
      );
    }

    // ── bulk insert all grade records
    await db.promise().query(
      `INSERT INTO grades
         (student_id, subject_id, teacher_id, upload_id,
          school_year_id, quarter, score, status)
       VALUES ?`,
      [gradeInserts]
    );

    return {
      uploadId,
      totalStudents: gradeInserts.length,
      notFound,
      resubmitted
    };
  };

  // ── run and respond
  runUpload()
    .then(result => {

      const message = result.resubmitted
        ? `Grades updated and resubmitted successfully. ` +
          `${result.totalStudents} student(s) sent for admin review.`
        : `Grades uploaded successfully. ` +
          `${result.totalStudents} student(s) submitted for admin approval.`;

      res.status(201).json({
        message,
        upload_id:      result.uploadId,
        total_students: result.totalStudents,
        not_found:      result.notFound,
        resubmitted:    result.resubmitted
      });
    })
    .catch(err => {
      console.error('Upload grades error:', err.message);

      const clientErrors = [
        'already approved',
        'locked and finalized',
        'already pending',
        'No matching students',
        'No active school year',
        'Teacher record not found',
        'No student data',
        'Validation errors'
      ];

      const isClientError = clientErrors.some(e =>
        err.message.includes(e)
      );

      res.status(isClientError ? 400 : 500).json({
        message: err.message || 'Server error saving grades'
      });
    });

};

// ==========================
// ADMIN APPROVE UPLOAD
// sets upload + all grades
// to approved — visible to students
// ==========================

const approveUpload = (req, res) => {

  const { id } = req.params;

  // approve all grades in this upload
  db.query(
    `UPDATE grades SET status = 'approved' WHERE upload_id = ?`,
    [id],
    (err) => {
      if(err) return res.status(500).json({ message: 'Server error' });

      // approve the upload batch
      db.query(
        `UPDATE uploads
         SET status = 'approved', reviewed_at = NOW()
         WHERE id = ?`,
        [id],
        (err2, result) => {
          if(err2) return res.status(500).json({ message: 'Server error' });
          if(result.affectedRows === 0){
            return res.status(404).json({ message: 'Upload not found' });
          }
          res.json({ message: 'Upload approved. Grades are now visible to students.' });
        }
      );
    }
  );

};

// ==========================
// ADMIN REJECT UPLOAD
// sets upload to rejected
// teacher can see remarks
// and resubmit
// ==========================

const rejectUpload = (req, res) => {

  const { id } = req.params;
  const { remarks } = req.body;

  if(!remarks){
    return res.status(400).json({
      message: 'Please provide a reason for rejection'
    });
  }

  db.query(
    `UPDATE uploads
     SET status = 'rejected',
         remarks = ?,
         reviewed_at = NOW()
     WHERE id = ?`,
    [remarks, id],
    (err, result) => {
      if(err) return res.status(500).json({ message: 'Server error' });
      if(result.affectedRows === 0){
        return res.status(404).json({ message: 'Upload not found' });
      }
      res.json({ message: 'Upload rejected. Teacher will be notified.' });
    }
  );

};

// ==========================
// ADMIN LOCK UPLOAD
// finalizes grades permanently
// cannot be edited after lock
// ==========================

const lockUpload = (req, res) => {

  const { id } = req.params;

  db.query(
    `UPDATE grades SET status = 'locked' WHERE upload_id = ?`,
    [id],
    (err) => {
      if(err) return res.status(500).json({ message: 'Server error' });

      db.query(
        `UPDATE uploads SET status = 'locked' WHERE id = ?`,
        [id],
        (err2, result) => {
          if(err2) return res.status(500).json({ message: 'Server error' });
          if(result.affectedRows === 0){
            return res.status(404).json({ message: 'Upload not found' });
          }
          res.json({ message: 'Upload locked. Grades are now finalized.' });
        }
      );
    }
  );

};

// ==========================
// GET TEACHER OWN UPLOADS
// for teacher upload history
// ==========================

const getTeacherUploads = (req, res) => {

  const teacherUserId = req.user.id;

  const sql = `
    SELECT
      u.id,
      u.grade_level,
      u.section,
      u.quarter,
      u.status,
      u.remarks,
      u.submitted_at,
      u.reviewed_at,
      s.name AS subject_name,
      sy.label AS school_year
    FROM uploads u
    JOIN teachers t ON u.teacher_id = t.id
    JOIN subjects s ON u.subject_id = s.id
    JOIN school_years sy ON u.school_year_id = sy.id
    WHERE t.user_id = ?
      AND sy.is_active = 1
    ORDER BY u.submitted_at DESC
  `;

  db.query(sql, [teacherUserId], (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    res.json(results);
  });

};

// ==========================
// GET STUDENT GRADES
// only approved grades visible
// filtered by school year
// and quarter
// ==========================

const getStudentGrades = (req, res) => {

  const userId = req.user.id;

  const sql = `
    SELECT
      g.score,
      g.quarter,
      g.status,
      s.name        AS subject_name,
      sy.label      AS school_year,
      sy.id         AS school_year_id,
      sy.is_active,
      u.grade_level,
      u.section
    FROM grades g
    JOIN subjects    s  ON g.subject_id    = s.id
    JOIN uploads     u  ON g.upload_id     = u.id
    JOIN school_years sy ON g.school_year_id = sy.id
    JOIN students    st ON g.student_id    = st.id
    WHERE st.user_id = ?
      AND g.status IN ('approved', 'locked')
    ORDER BY sy.id DESC, s.name ASC, g.quarter ASC
  `;

  db.query(sql, [userId], (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    res.json(results);
  });

};

// ==========================
// GENERATE GRADE TEMPLATE
// reads base xlsx from assets
// fills header + student list
// sends as download
// ==========================
 
const generateGradeTemplate = async (req, res) => {

  const { subject_id, grade_level, section, quarter } = req.query;

  if(!subject_id || !grade_level || !section || !quarter){
    return res.status(400).json({
      message: 'subject_id, grade_level, section and quarter are required'
    });
  }

  try {

    // get subject name
    const [subjects] = await db.promise().query(
      'SELECT name FROM subjects WHERE id = ?',
      [subject_id]
    );

    if(subjects.length === 0){
      return res.status(404).json({ message: 'Subject not found' });
    }

    const subjectName = subjects[0].name;

    // get active school year
    const [years] = await db.promise().query(
      'SELECT label FROM school_years WHERE is_active = 1 LIMIT 1'
    );

    const schoolYear = years.length > 0 ? years[0].label : '—';

    // get students enrolled in this class
    const [students] = await db.promise().query(
      `SELECT st.full_name, st.lrn
       FROM students st
       JOIN student_enrollments se ON st.id = se.student_id
       JOIN school_years sy ON se.school_year_id = sy.id
       WHERE se.grade_level = ?
         AND se.section     = ?
         AND sy.is_active   = 1
         AND st.is_archived = 0
       ORDER BY st.full_name ASC`,
      [grade_level, section]
    );

    // ── build worksheet using array-of-arrays
    // this gives full control over layout
    // xlsx npm package supports cell styles via the xlsx-style fork
    // but since we only have xlsx, we use cell comments and
    // width/height for structure, and rely on the clean layout

    const wb = xlsx.utils.book_new();

    // build data rows
    const wsData = [];

    // Row 1: Title
    wsData.push(['GRADE UPLOAD TEMPLATE', '', '']);

    // Row 2: spacer
    wsData.push(['', '', '']);

    // Rows 3-7: header info
    wsData.push(['Subject:',     subjectName,        'Do not change']);
    wsData.push(['School Year:', schoolYear,         'Do not change']);
    wsData.push(['Grade Level:', grade_level,        'Do not change']);
    wsData.push(['Section:',     section,            'Do not change']);
    wsData.push(['Quarter:',     quarter + ' Quarter','Do not change']);

    // Row 8: spacer
    wsData.push(['', '', '']);

    // Row 9: column headers
    wsData.push(['Full Name', 'LRN', 'Final Grade']);

    // Rows 10-109: student data (100 rows)
    for(let i = 0; i < 100; i++){
      if(i < students.length){
        wsData.push([students[i].full_name, String(students[i].lrn), '']);
      } else {
        wsData.push(['', '', '']);
      }
    }

    // convert to worksheet
    const ws = xlsx.utils.aoa_to_sheet(wsData);

    // set column widths
    ws['!cols'] = [
      { wch: 32 }, // A - Full Name
      { wch: 20 }, // B - LRN
      { wch: 16 }  // C - Final Grade
    ];

    // set row heights using !rows
    ws['!rows'] = [
      { hpt: 28 },  // row 1 - title
      { hpt: 6  },  // row 2 - spacer
      { hpt: 20 },  // row 3 - Subject
      { hpt: 20 },  // row 4 - School Year
      { hpt: 20 },  // row 5 - Grade Level
      { hpt: 20 },  // row 6 - Section
      { hpt: 20 },  // row 7 - Quarter
      { hpt: 8  },  // row 8 - spacer
      { hpt: 22 }   // row 9 - headers
    ];

    // add to workbook
    xlsx.utils.book_append_sheet(wb, ws, 'Grade Upload');

    // write to buffer
    const buffer = xlsx.write(wb, {
      type:     'buffer',
      bookType: 'xlsx'
    });

    // build filename
    const filename = [
      'grades',
      subjectName.replace(/\s+/g, '_'),
      grade_level.replace(/\s+/g, '_'),
      section.replace(/\s+/g, '_'),
      quarter.replace(/\s+/g, '_')
    ].join('_') + '.xlsx';

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.send(buffer);

  } catch(err) {
    console.error('Generate template error:', err);
    res.status(500).json({
      message: 'Server error generating template',
      error: err.message
    });
  }

};
 
// ==========================
// PREVIEW GRADES
// reads uploaded excel file
// finds the student table by
// locating the LRN header row
// validates without saving
// ==========================
 
const previewGrades = (req, res) => {
 
  if(!req.file){
    return res.status(400).json({ message: 'No file uploaded' });
  }
 
  let workbook, ws;
 
  try {
    workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    ws = workbook.Sheets[sheetName];
  } catch(e) {
    return res.status(400).json({
      message: 'Could not read file. Make sure it is .xlsx or .xls.'
    });
  }
 
  // ── find the row that contains the LRN header
  // the template has headers at row 9 (0-indexed: row 8)
  // we scan from row 0 to row 20 to find it
 
  const range = xlsx.utils.decode_range(ws['!ref'] || 'A1:C1');
  let headerRow = -1;
 
  for(let r = 0; r <= Math.min(range.e.r, 20); r++){
    // check column A and column B for LRN keyword
    for(let c = 0; c <= 2; c++){
      const ref  = xlsx.utils.encode_cell({ r, c });
      const cell = ws[ref];
      if(cell && String(cell.v || '').trim().toUpperCase() === 'LRN'){
        headerRow = r;
        break;
      }
    }
    if(headerRow !== -1) break;
  }
 
  if(headerRow === -1){
    return res.status(400).json({
      message:
        'Could not find the "LRN" column header. ' +
        'Make sure you are using the downloaded template without modifying the headers.'
    });
  }
 
  // ── find which column is LRN, Full Name, Final Grade
  let colLRN   = -1;
  let colName  = -1;
  let colGrade = -1;
 
  for(let c = 0; c <= range.e.c; c++){
    const ref  = xlsx.utils.encode_cell({ r: headerRow, c });
    const cell = ws[ref];
    if(!cell) continue;
    const val = String(cell.v || '').trim().toUpperCase();
    if(val === 'LRN')          colLRN   = c;
    if(val === 'FULL NAME')    colName  = c;
    if(val === 'FINAL GRADE')  colGrade = c;
    if(val === 'SCORE')        colGrade = c; // fallback
  }
 
  if(colLRN === -1){
    return res.status(400).json({
      message: 'LRN column not found. Use the downloaded template.'
    });
  }
 
  if(colGrade === -1){
    return res.status(400).json({
      message:
        'Final Grade column not found. ' +
        'Fill in the Final Grade column before uploading.'
    });
  }
 
  // ── read student rows — everything below the header row
  const result = [];
  let rowNum = 0;
 
    // stop at row 109 (index 108) — row 111 is instructions in col D
    const lastDataRow = Math.min(range.e.r, 108);
    for(let r = headerRow + 1; r <= lastDataRow; r++){
 
    const lrnRef   = xlsx.utils.encode_cell({ r, c: colLRN });
    const nameRef  = colName  !== -1
      ? xlsx.utils.encode_cell({ r, c: colName })
      : null;
    const gradeRef = xlsx.utils.encode_cell({ r, c: colGrade });
 
    const lrnCell   = ws[lrnRef];
    const nameCell  = nameRef ? ws[nameRef] : null;
    const gradeCell = ws[gradeRef];
 
    const lrn   = lrnCell   ? String(lrnCell.v   || '').trim() : '';
    const name  = nameCell  ? String(nameCell.v  || '').trim() : '';
    const raw   = gradeCell ? gradeCell.v : '';
    const score = parseFloat(raw);
 
    // skip completely empty rows
    if(!lrn && !name && (raw === '' || raw === undefined)){
      continue;
    }
 
    rowNum++;
 
    if(!lrn){
      result.push({
        row:   r + 1,
        lrn:   '—',
        name:  name || '—',
        score: '—',
        valid: false,
        error: 'Missing LRN'
      });
      continue;
    }
 
    if(raw === '' || raw === undefined || raw === null){
      result.push({
        row:   r + 1,
        lrn,
        name,
        score: '(empty)',
        valid: false,
        error: 'Final Grade is empty — fill in the grade before uploading'
      });
      continue;
    }
 
    if(isNaN(score)){
      result.push({
        row:   r + 1,
        lrn,
        name,
        score: raw,
        valid: false,
        error: `"${raw}" is not a valid number`
      });
      continue;
    }
 
    if(score < 0 || score > 100){
      result.push({
        row:   r + 1,
        lrn,
        name,
        score,
        valid: false,
        error: `Grade ${score} is out of range (must be 0–100)`
      });
      continue;
    }
 
    result.push({
      row:   r + 1,
      lrn,
      name,
      score,
      valid: true,
      error: null
    });
  }
 
  if(result.length === 0){
    return res.status(400).json({
      message:
        'No student data found below the header row. ' +
        'Make sure students are listed below the Full Name | LRN | Final Grade headers.'
    });
  }
 
  res.json({ rows: result });
 
};

// ==========================
// GET TEACHER'S GRADE RECORDS
// returns all grades submitted
// by this teacher — no admin needed
// ==========================

const getTeacherGradeRecords = (req, res) => {

  const teacherUserId = req.user.id;

  const sql = `
    SELECT
      g.id,
      g.score,
      g.quarter,
      g.status,
      st.full_name  AS student_name,
      st.lrn,
      s.name        AS subject_name,
      u.grade_level,
      u.section,
      sy.label      AS school_year
    FROM grades g
    JOIN students    st ON g.student_id    = st.id
    JOIN subjects    s  ON g.subject_id    = s.id
    JOIN uploads     u  ON g.upload_id     = u.id
    JOIN teachers    t  ON g.teacher_id    = t.id
    JOIN school_years sy ON g.school_year_id = sy.id
    WHERE t.user_id    = ?
      AND sy.is_active = 1
    ORDER BY u.grade_level, u.section, st.full_name, s.name ASC
  `;

  db.query(sql, [teacherUserId], (err, results) => {
    if(err){
      return res.status(500).json({
        message: 'Server error',
        error: err.message
      });
    }
    res.json(results);
  });

};

const exportTeacherGrades = async (req, res) => {

  const teacherUserId = req.user.id;
  const { subject, section, quarter, status } = req.query;

  let sql = `
    SELECT
      st.full_name  AS student_name,
      st.lrn,
      s.name        AS subject_name,
      u.grade_level,
      u.section,
      g.quarter,
      g.score,
      g.status,
      sy.label      AS school_year
    FROM grades g
    JOIN students    st ON g.student_id    = st.id
    JOIN subjects    s  ON g.subject_id    = s.id
    JOIN uploads     u  ON g.upload_id     = u.id
    JOIN teachers    t  ON g.teacher_id    = t.id
    JOIN school_years sy ON g.school_year_id = sy.id
    WHERE t.user_id    = ?
      AND sy.is_active = 1
  `;

  const params = [teacherUserId];

  if(subject){ sql += ' AND s.name = ?';      params.push(subject); }
  if(section){ sql += ' AND u.section = ?';   params.push(section); }
  if(quarter){ sql += ' AND g.quarter = ?';   params.push(quarter); }
  if(status) { sql += ' AND g.status = ?';    params.push(status);  }

  sql += ' ORDER BY u.grade_level, u.section, st.full_name, s.name ASC';

  try {

    const [records] = await db.promise().query(sql, params);

    if(records.length === 0){
      return res.status(404).json({
        message: 'No grade records found for the selected filters'
      });
    }

    // build excel
    const wb = xlsx.utils.book_new();

    // title row and headers
    const wsData = [];
    wsData.push(['GRADE RECORDS EXPORT']);
    wsData.push([`School Year: ${records[0].school_year}`]);
    wsData.push([]);
    wsData.push([
      'Student Name',
      'LRN',
      'Subject',
      'Grade Level',
      'Section',
      'Quarter',
      'Score',
      'Status'
    ]);

    records.forEach(r => {
      wsData.push([
        r.student_name,
        String(r.lrn),
        r.subject_name,
        r.grade_level,
        r.section,
        r.quarter + ' Quarter',
        r.score,
        r.status.charAt(0).toUpperCase() + r.status.slice(1)
      ]);
    });

    const ws = xlsx.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
      { wch: 28 },
      { wch: 18 },
      { wch: 20 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 }
    ];

    xlsx.utils.book_append_sheet(wb, ws, 'Grade Records');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `grade_records_${Date.now()}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.send(buffer);

  } catch(err) {
    console.error('Export grades error:', err);
    res.status(500).json({ message: 'Server error exporting grades' });
  }

};

module.exports = {
  upload,
  getAllUploads,
  getUploadCounts,
  getUploadDetails,
  uploadGrades,
  approveUpload,
  rejectUpload,
  lockUpload,
  unapproveUpload,
  getTeacherUploads,
  getTeacherGradeRecords,
  getStudentGrades,
  previewGrades,
  generateGradeTemplate,
  getUploadSubjects,
  getUploadSections,
  exportTeacherGrades
};