const db = require('../config/db');

// ==========================
// GET ALL SCHOOL YEARS
// ==========================

const getAllSchoolYears = (req, res) => {

  const sql = `
    SELECT sy.*, qc.total_quarters, qc.active_quarter, qc.mode
    FROM school_years sy
    LEFT JOIN quarters_config qc ON sy.id = qc.school_year_id
    ORDER BY sy.created_at DESC
  `;

  db.query(sql, (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    res.json(results);
  });

};

// ==========================
// GET ACTIVE SCHOOL YEAR
// ==========================

const getActiveSchoolYear = (req, res) => {

  const sql = `
    SELECT sy.*, qc.total_quarters, qc.active_quarter, qc.mode
    FROM school_years sy
    LEFT JOIN quarters_config qc ON sy.id = qc.school_year_id
    WHERE sy.is_active = 1
    LIMIT 1
  `;

  db.query(sql, (err, results) => {
    if(err) return res.status(500).json({ message: 'Server error' });
    if(results.length === 0){
      return res.status(404).json({ message: 'No active school year found' });
    }
    res.json(results[0]);
  });

};

// ==========================
// ADD NEW SCHOOL YEAR
// deactivates current year
// creates new quarters config
// ==========================

const addSchoolYear = (req, res) => {

  const { label, total_quarters, mode } = req.body;

  if(!label){
    return res.status(400).json({ message: 'School year label is required' });
  }

  // deactivate all current years
  db.query('UPDATE school_years SET is_active = 0', (err) => {
    if(err) return res.status(500).json({ message: 'Server error' });

    // insert new school year as active
    db.query(
      'INSERT INTO school_years (label, is_active) VALUES (?, 1)',
      [label],
      (err2, result) => {
        if(err2){
          if(err2.code === 'ER_DUP_ENTRY'){
            return res.status(400).json({
              message: 'School year already exists'
            });
          }
          return res.status(500).json({ message: 'Server error' });
        }

        const schoolYearId = result.insertId;

        // create quarters config for new year
        db.query(
          `INSERT INTO quarters_config
            (school_year_id, total_quarters, active_quarter, mode)
           VALUES (?, ?, 1, ?)`,
          [schoolYearId, total_quarters || 4, mode || 'manual'],
          (err3) => {
            if(err3) return res.status(500).json({ message: 'Server error' });
            res.status(201).json({
              message: 'New school year created successfully',
              id: schoolYearId
            });
          }
        );
      }
    );
  });

};

// ==========================
// UPDATE ACTIVE QUARTER
// admin manually sets quarter
// or switches to auto mode
// ==========================

const updateActiveQuarter = (req, res) => {

  const { active_quarter, mode, total_quarters } = req.body;

  const sql = `
    UPDATE quarters_config qc
    JOIN school_years sy ON qc.school_year_id = sy.id
    SET qc.active_quarter = ?,
        qc.mode = ?,
        qc.total_quarters = ?
    WHERE sy.is_active = 1
  `;

  db.query(sql, [active_quarter, mode || 'manual', total_quarters || 4], (err) => {
    if(err) return res.status(500).json({ message: 'Server error', error: err.message });
    res.json({ message: 'Active quarter updated successfully' });
  });

};
const closeSchoolYear = async (req, res) => {

  const { new_label } = req.body;

  if(!new_label || !new_label.trim()){
    return res.status(400).json({
      message: 'New school year label is required'
    });
  }

  try {

    // check new label doesn't already exist
    const [existing] = await db.promise().query(
      'SELECT id FROM school_years WHERE label = ?',
      [new_label.trim()]
    );

    if(existing.length > 0){
      return res.status(400).json({
        message: `School year "${new_label}" already exists`
      });
    }

    // get current active year
    const [currentYear] = await db.promise().query(
      'SELECT id, label FROM school_years WHERE is_active = 1 LIMIT 1'
    );

    // ✅ if no active year exists (fresh/wiped database)
    // just create the first school year directly
    if(currentYear.length === 0){
      const [newYear] = await db.promise().query(
        `INSERT INTO school_years (label, is_active) VALUES (?, 1)`,
        [new_label.trim()]
      );
      const newYearId = newYear.insertId;
      await db.promise().query(
        `INSERT INTO quarters_config
           (school_year_id, total_quarters, active_quarter, mode)
         VALUES (?, 4, 1, 'manual')`,
        [newYearId]
      );
      return res.json({
        message: `School year "${new_label}" created successfully.`,
        new_year_id: newYearId
      });
    }

    const oldYearId = currentYear[0].id;

    // deactivate old year
    await db.promise().query(
      'UPDATE school_years SET is_active = 0 WHERE id = ?',
      [oldYearId]
    );

    // create new active school year
    const [newYear] = await db.promise().query(
      `INSERT INTO school_years (label, is_active) VALUES (?, 1)`,
      [new_label.trim()]
    );

    const newYearId = newYear.insertId;

    // create quarters config for new year
    await db.promise().query(
      `INSERT INTO quarters_config
         (school_year_id, total_quarters, active_quarter, mode)
       VALUES (?, 4, 1, 'manual')`,
      [newYearId]
    );

    res.json({
      message: `School year closed. New school year "${new_label}" is now active.`,
      old_year_id: oldYearId,
      new_year_id: newYearId
    });

  } catch(err) {
    console.error('Close school year error:', err);
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }

};

module.exports = {
  getAllSchoolYears,
  getActiveSchoolYear,
  addSchoolYear,
  updateActiveQuarter,
  closeSchoolYear
};