const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();


// ==========================
// LOGIN
// ==========================

const login = (req, res) => {

  const { username, password } = req.body;

  if(!username || !password){
    return res.status(400).json({
      message: 'Username and password are required'
    });
  }

  const sql = 'SELECT * FROM users WHERE username = ?';

  db.query(sql, [username], async (err, results) => {

    if(err) return res.status(500).json({ message: 'Server error' });

    if(results.length === 0){
      return res.status(401).json({
        message: 'Invalid username or password'
      });
    }

    const user = results[0];

    // block if not activated
    if(user.status === 'not_activated'){
      return res.status(403).json({
        message: 'Account not yet activated. Please activate your account first.',
        code: 'NOT_ACTIVATED'
      });
    }

    // check password
    const isMatch = await bcrypt.compare(password, user.password);

    if(!isMatch){
      return res.status(401).json({
        message: 'Invalid username or password'
      });
    }

    // generate JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      role: user.role,
      username: user.username
    });

  });

};


// ==========================
// ACTIVATE — STUDENT
// ==========================

const activateStudent = async (req, res) => {

  const {
    lrn,
    full_name,
    temp_password,
    new_password,
    confirm_password
  } = req.body;

  if(!lrn || !full_name || !temp_password || !new_password || !confirm_password){
    return res.status(400).json({ message: 'All fields are required' });
  }

  if(new_password !== confirm_password){
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  if(new_password.length < 8){
    return res.status(400).json({
      message: 'Password must be at least 8 characters'
    });
  }

  // find student by LRN
  const sql = `
    SELECT s.*, u.status, u.id AS user_id, u.temp_password AS stored_temp
    FROM students s
    JOIN users u ON s.user_id = u.id
    WHERE s.lrn = ?
  `;

  db.query(sql, [lrn], async (err, results) => {

    if(err) return res.status(500).json({ message: 'Server error' });

    if(results.length === 0){
      return res.status(404).json({
        message: 'LRN not found. Please contact your administrator.'
      });
    }

    const student = results[0];

    // already activated?
    if(student.status === 'activated'){
      return res.status(400).json({
        message: 'Account already activated. Please login normally.',
        code: 'ALREADY_ACTIVATED'
      });
    }

    // verify full name
    const dbName = student.full_name.toLowerCase().trim();
    const inputName = full_name.toLowerCase().trim();

    if(dbName !== inputName){
      return res.status(401).json({
        message: 'Full name does not match our records.'
      });
    }

    // verify temp password against stored plain temp
    if(temp_password !== student.stored_temp){
      return res.status(401).json({
        message: 'Incorrect temporary password.'
      });
    }

    // all verified — activate
    completeActivation(student.user_id, new_password, res);

  });

};


// ==========================
// ACTIVATE — TEACHER
// ==========================

const activateTeacher = async (req, res) => {

  const {
    prc_id,
    full_name,
    temp_password,
    new_password,
    confirm_password
  } = req.body;

  if(!prc_id || !full_name || !temp_password || !new_password || !confirm_password){
    return res.status(400).json({ message: 'All fields are required' });
  }

  if(new_password !== confirm_password){
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  if(new_password.length < 8){
    return res.status(400).json({
      message: 'Password must be at least 8 characters'
    });
  }

  // find teacher by PRC ID
  const sql = `
    SELECT t.*, u.status, u.id AS user_id, u.temp_password AS stored_temp
    FROM teachers t
    JOIN users u ON t.user_id = u.id
    WHERE t.prc_id = ?
  `;

  db.query(sql, [prc_id], async (err, results) => {

    if(err) return res.status(500).json({ message: 'Server error' });

    if(results.length === 0){
      return res.status(404).json({
        message: 'PRC ID not found. Please contact your administrator.'
      });
    }

    const teacher = results[0];

    // already activated?
    if(teacher.status === 'activated'){
      return res.status(400).json({
        message: 'Account already activated. Please login normally.',
        code: 'ALREADY_ACTIVATED'
      });
    }

    // verify full name
    const dbName = teacher.full_name.toLowerCase().trim();
    const inputName = full_name.toLowerCase().trim();

    if(dbName !== inputName){
      return res.status(401).json({
        message: 'Full name does not match our records.'
      });
    }

    // verify temp password
    if(temp_password !== teacher.stored_temp){
      return res.status(401).json({
        message: 'Incorrect temporary password.'
      });
    }

    // all verified — activate
    completeActivation(teacher.user_id, new_password, res);

  });

};


// ==========================
// COMPLETE ACTIVATION
// ==========================

async function completeActivation(userId, newPassword, res){

  try {

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const sql = `
      UPDATE users
      SET password = ?,
          status = 'activated',
          temp_password = NULL,
          first_login = 0
      WHERE id = ?
    `;

    db.query(sql, [hashedPassword, userId], (err) => {
      if(err) return res.status(500).json({ message: 'Server error' });

      res.json({
        message: 'Account activated successfully! You can now login.'
      });
    });

  } catch(err) {
    res.status(500).json({ message: 'Server error' });
  }

}
const changeAdminCredentials = async (req, res) => {

  const { current_password, new_username, new_password } = req.body;
  const userId = req.user.id;

  if(!current_password){
    return res.status(400).json({
      message: 'Current password is required'
    });
  }

  if(!new_username && !new_password){
    return res.status(400).json({
      message: 'Provide a new username or new password'
    });
  }

  try {

    // get current user
    const [users] = await db.promise().query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if(users.length === 0){
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    // verify current password
    const isMatch = await bcrypt.compare(current_password, user.password);
    if(!isMatch){
      return res.status(400).json({
        message: 'Current password is incorrect'
      });
    }

    // build update
    const updates = [];
    const params  = [];

    if(new_username && new_username.trim() !== user.username){
      // check username not taken
      const [existing] = await db.promise().query(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [new_username.trim(), userId]
      );
      if(existing.length > 0){
        return res.status(400).json({
          message: 'Username already taken'
        });
      }
      updates.push('username = ?');
      params.push(new_username.trim());
    }

    if(new_password){
      if(new_password.length < 6){
        return res.status(400).json({
          message: 'New password must be at least 6 characters'
        });
      }
      const hashed = await bcrypt.hash(new_password, 10);
      updates.push('password = ?');
      params.push(hashed);
    }

    if(updates.length === 0){
      return res.status(400).json({
        message: 'No changes detected'
      });
    }

    params.push(userId);

    await db.promise().query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({
      message: 'Credentials updated successfully. Please log in again.',
      username_changed: !!new_username
    });

  } catch(err) {
    console.error('Change credentials error:', err);
    res.status(500).json({ message: 'Server error' });
  }

};

const changePassword = async (req, res) => {

  const { current_password, new_password } = req.body;
  const userId = req.user.id;

  if(!current_password || !new_password){
    return res.status(400).json({
      message: 'Current password and new password are required'
    });
  }

  if(new_password.length < 6){
    return res.status(400).json({
      message: 'New password must be at least 6 characters'
    });
  }

  try {

    const [users] = await db.promise().query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if(users.length === 0){
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(current_password, users[0].password);
    if(!isMatch){
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(new_password, 10);

    await db.promise().query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashed, userId]
    );

    res.json({
      message: 'Password changed successfully. Please log in again.'
    });

  } catch(err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Server error' });
  }

};


module.exports = {
  login,
  activateStudent,
  activateTeacher,
  changeAdminCredentials,
  changePassword
};