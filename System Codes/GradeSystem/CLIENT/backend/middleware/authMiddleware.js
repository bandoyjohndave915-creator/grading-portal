const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {

  const authHeader = req.headers['authorization'];

  if(!authHeader){
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  if(!token){
    return res.status(401).json({ message: 'Token missing' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {

    if(err){
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    req.user = decoded;
    next();

  });

};

const isAdmin = (req, res, next) => {
  if(req.user.role !== 'admin'){
    return res.status(403).json({ message: 'Admin access only' });
  }
  next();
};

const isTeacher = (req, res, next) => {
  if(req.user.role !== 'teacher'){
    return res.status(403).json({ message: 'Teacher access only' });
  }
  next();
};

const isStudent = (req, res, next) => {
  if(req.user.role !== 'student'){
    return res.status(403).json({ message: 'Student access only' });
  }
  next();
};
const isTeacherOrAdmin = (req, res, next) => {
  if(req.user.role !== 'teacher' && req.user.role !== 'admin'){
    return res.status(403).json({
      message: 'Teacher or admin access required'
    });
  }
  next();
};


module.exports = { verifyToken, isAdmin, isTeacher, isStudent, isTeacherOrAdmin };