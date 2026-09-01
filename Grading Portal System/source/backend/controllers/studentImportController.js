// ============================================================
// studentImportController.js
//
// Handles Excel student import with the following format:
//
// Row 1: "STUDENT IMPORT TEMPLATE"  (title — ignored)
// Row 2: blank spacer
// Row 3: School Year:   [value in column B]
// Row 4: Grade Level:   [value in column B]
// Row 5: Section:       [value in column B]
// Row 6: blank spacer
// Row 7: LRN | Full Name  (table header)
// Row 8+: student data rows
// ============================================================

const db     = require('../config/db');
const multer = require('multer');
const xlsx   = require('xlsx');
const path   = require('path');
const fs     = require('fs');
const bcrypt = require('bcryptjs');


// ==============================
// MULTER STORAGE
// ==============================

const importStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(
      __dirname, '../../uploads/excel-files'
    );
    if(!fs.existsSync(uploadPath)){
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `import_${Date.now()}_${file.originalname}`);
  }
});

const importUpload = multer({
  storage: importStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if(!['.xlsx', '.xls'].includes(ext)){
      return cb(new Error('Only Excel files (.xlsx or .xls) are allowed.'));
    }
    cb(null, true);
  }
});


// ==============================
// HELPER: extract header value
// reads "Label:" from column A
// and returns value from column B
// ==============================

function extractHeader(sheet, rowNum) {
  const colB = xlsx.utils.encode_cell({ r: rowNum - 1, c: 1 });
  const cell  = sheet[colB];
  if(!cell || cell.v === undefined || cell.v === null) return null;
  return String(cell.v).trim();
}


// ==============================
// GENERATE TEMP PASSWORD
// FirstInitial.Lastname + last4
// e.g. J.Bansag0004
// ==============================

function generateTempPassword(fullName, lrn) {
  const parts        = fullName.trim().split(' ');
  const firstName    = parts[0]   || 'X';
  const lastName     = parts[parts.length - 1] || 'X';
  const firstInitial = firstName[0].toUpperCase();
  const last4        = String(lrn).slice(-4);
  return `${firstInitial}.${lastName}${last4}`;
}


// ==============================
// MAIN IMPORT FUNCTION
// ==============================

const importStudentsFromExcel = async (req, res) => {

  // ── 1. File validation
  if(!req.file){
    return res.status(400).json({
      message: 'Import Failed: No file uploaded. Please attach an Excel file.'
    });
  }

  // ── 2. Read workbook
  let workbook, sheet;

  try {
    workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    sheet    = workbook.Sheets[sheetName];
  } catch(e) {
    return res.status(400).json({
      message: 'Import Failed: Could not read the Excel file. Make sure it is a valid .xlsx or .xls file.'
    });
  }

  // ── 3. Read header rows (rows 3, 4, 5 → index 2, 3, 4 in 0-based)
  //    Template layout:
  //    Row 1: title (ignored)
  //    Row 2: spacer
  //    Row 3: School Year:  [B3]
  //    Row 4: Grade Level:  [B4]
  //    Row 5: Section:      [B5]
  //    Row 6: spacer
  //    Row 7: LRN | Full Name  (header)
  //    Row 8+: student rows

  const schoolYear = extractHeader(sheet, 3);
  const gradeLevel = extractHeader(sheet, 4);
  const section    = extractHeader(sheet, 5);

  // validate header values
  const missingHeaders = [];
  if(!schoolYear) missingHeaders.push('School Year (cell B3)');
  if(!gradeLevel) missingHeaders.push('Grade Level (cell B4)');
  if(!section)    missingHeaders.push('Section (cell B5)');

  if(missingHeaders.length > 0){
    return res.status(400).json({
      message: `Import Failed: Missing required header information — ${missingHeaders.join(', ')}.`
    });
  }

  // validate grade level format
  const validGrades = [
    'Grade 1','Grade 2','Grade 3',
    'Grade 4','Grade 5','Grade 6'
  ];

  if(!validGrades.includes(gradeLevel)){
    return res.status(400).json({
      message: `Import Failed: Invalid Grade Level "${gradeLevel}". Must be one of: Grade 1, Grade 2, Grade 3, Grade 4, Grade 5, Grade 6.`
    });
  }

  // ── 4. Read student rows starting from row 8
  //    Row 7 is the column header: LRN | Full Name
  //    Read raw cells from row 8 onwards

  const range = xlsx.utils.decode_range(sheet['!ref'] || 'A1:B1');
  const studentRows = [];

  // row 7 (index 6) is the header — students start at row 8 (index 7)
// stop at row 108 (index 107) to avoid reading
// the instructions note at row 109
const lastStudentRow = Math.min(range.e.r, 106);

for(let r = 7; r <= lastStudentRow; r++) {

    const lrnCell  = sheet[xlsx.utils.encode_cell({ r, c: 0 })];
    const nameCell = sheet[xlsx.utils.encode_cell({ r, c: 1 })];

    const lrn      = lrnCell  ? String(lrnCell.v  || '').trim() : '';
    const fullName = nameCell ? String(nameCell.v || '').trim() : '';

    // skip completely empty rows
    if(!lrn && !fullName) continue;

    studentRows.push({
      rowNum: r + 1, // 1-based for error messages
      lrn,
      fullName
    });
  }

  // ── 5. Validate column headers exist (row 7)
  const lrnHeader  = sheet[xlsx.utils.encode_cell({ r: 6, c: 0 })];
  const nameHeader = sheet[xlsx.utils.encode_cell({ r: 6, c: 1 })];

  const lrnHeaderVal  = lrnHeader  ? String(lrnHeader.v  || '').trim().toLowerCase() : '';
  const nameHeaderVal = nameHeader ? String(nameHeader.v || '').trim().toLowerCase() : '';

  if(!lrnHeaderVal.includes('lrn')){
    return res.status(400).json({
      message: 'Import Failed: Missing column "LRN" in row 7. Make sure column A row 7 says "LRN".'
    });
  }

  if(!nameHeaderVal.includes('name')){
    return res.status(400).json({
      message: 'Import Failed: Missing column "Full Name" in row 7. Make sure column B row 7 says "Full Name".'
    });
  }

  if(studentRows.length === 0){
    return res.status(400).json({
      message: 'Import Failed: No student data found. Add student rows below the header row (row 7).'
    });
  }


// ── 6. Get the ACTIVE school year
// The admin sets the active school year in Settings.
// The import always uses the currently active one.
// The school year label in the Excel file is used for validation only.

let schoolYearId;
let activeSchoolYearLabel;

try {
  const [activeYears] = await db.promise().query(
    'SELECT id, label FROM school_years WHERE is_active = 1 LIMIT 1'
  );

  if(activeYears.length === 0){
    return res.status(400).json({
      message:
        'No active school year found. ' +
        'Please set an active school year in Settings before importing students.'
    });
  }

  schoolYearId          = activeYears[0].id;
  activeSchoolYearLabel = activeYears[0].label;

  // warn if Excel school year doesn't match active school year
  // but still proceed using the active one
  if(schoolYear && schoolYear.trim() !== activeSchoolYearLabel.trim()){
    console.warn(
      `Excel school year "${schoolYear}" does not match ` +
      `active school year "${activeSchoolYearLabel}". ` +
      `Using active school year.`
    );
  }

} catch(e) {
  return res.status(500).json({
    message: 'Server error getting active school year.',
    error: e.message
  });
}

  // ── 7. Process each student row

  const results = {
    total:     studentRows.length,
    imported:  0,
    failed:    0,
    errors:    []
  };

  for(const row of studentRows){

    const { rowNum, lrn, fullName } = row;

    // row-level validation
    if(!lrn){
      results.failed++;
      results.errors.push(`Row ${rowNum}: Missing LRN`);
      continue;
    }

    if(!fullName){
      results.failed++;
      results.errors.push(`Row ${rowNum}: Full Name missing for LRN ${lrn}`);
      continue;
    }

    try {

      // check if student already exists (by LRN)
      const [existing] = await db.promise().query(
        'SELECT id FROM students WHERE lrn = ?',
        [lrn]
      );

      let studentId;

      if(existing.length > 0){

        // RETURNING STUDENT — student record exists
        studentId = existing[0].id;

        // update name in case it changed
        await db.promise().query(
          'UPDATE students SET full_name = ? WHERE id = ?',
          [fullName, studentId]
        );

        // check for duplicate enrollment (same LRN + same school year)
        const [existingEnroll] = await db.promise().query(
          `SELECT id FROM student_enrollments
           WHERE student_id = ? AND school_year_id = ?`,
          [studentId, schoolYearId]
        );

        if(existingEnroll.length > 0){
          // already enrolled this school year — reject this row
          results.failed++;
          results.errors.push(
            `Row ${rowNum}: Student with LRN ${lrn} (${fullName}) ` +
            `is already enrolled for School Year ${schoolYear}`
          );
          continue;
        }

        // create new enrollment for this school year
        await db.promise().query(
          `INSERT INTO student_enrollments
             (student_id, school_year_id, grade_level, section)
           VALUES (?, ?, ?, ?)`,
          [studentId, schoolYearId, gradeLevel, section]
        );

      } else {

        // NEW STUDENT — create everything from scratch

        // generate temp password
        const tempPassword = generateTempPassword(fullName, lrn);
        const hashedTemp   = await bcrypt.hash(tempPassword, 10);

        // create user account
        const [userResult] = await db.promise().query(
          `INSERT INTO users
             (username, password, role, status, temp_password, first_login)
           VALUES (?, ?, 'student', 'not_activated', ?, 1)`,
          [lrn, hashedTemp, tempPassword]
        );

        const userId = userResult.insertId;

        // create student record
        const [studentResult] = await db.promise().query(
          `INSERT INTO students (lrn, full_name, user_id)
           VALUES (?, ?, ?)`,
          [lrn, fullName, userId]
        );

        studentId = studentResult.insertId;

        // create enrollment record
        await db.promise().query(
          `INSERT INTO student_enrollments
             (student_id, school_year_id, grade_level, section)
           VALUES (?, ?, ?, ?)`,
          [studentId, schoolYearId, gradeLevel, section]
        );

      }

      results.imported++;

    } catch(err) {

      results.failed++;

      // duplicate entry for username (LRN used as username)
      if(err.code === 'ER_DUP_ENTRY'){
        results.errors.push(
          `Row ${rowNum}: LRN ${lrn} already registered in the system.`
        );
      } else {
        results.errors.push(
          `Row ${rowNum}: Unexpected error — ${err.message}`
        );
      }
    }
  }

  // ── 8. Return import summary
  res.status(200).json({
    message: `Import Complete — ${results.imported} imported, ${results.failed} failed out of ${results.total} total.`,
    school_year: activeSchoolYearLabel,
    grade_level: gradeLevel,
    section:     section,
    total:       results.total,
    imported:    results.imported,
    failed:      results.failed,
    errors:      results.errors
  });

};


// ==============================
// EXPORTS
// ==============================

module.exports = {
  importUpload,
  importStudentsFromExcel
};