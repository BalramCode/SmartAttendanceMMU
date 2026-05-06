const express = require('express');
const { body, param } = require('express-validator');
const {
  markAttendance,
  getStudentAttendance,
  getSessionAttendance,
  getStudentDashboard,   // ✅ ADD THIS
  getTeacherDashboard,
} = require('../controllers/attendanceController');
// const { getTeacherDashboard } = require('../controllers/attendanceController');
const { protect, authorise } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// Student: mark attendance
router.post(
  '/mark',
  protect,
  authorise('student'),
  [body('qrToken').notEmpty().withMessage('QR token is required')],
  validate,
  markAttendance
);

// Student: view own attendance history
router.get('/student', protect, authorise('student'), getStudentAttendance);
// Student: dashboard stats (avg attendance + recent logs)
router.get(
  '/student/dashboard',
  protect,
  authorise('student'),
  getStudentDashboard
);

router.get(
  '/teacher/dashboard-stats', 
  protect, 
  authorise('teacher'), 
  getTeacherDashboard
);

// Teacher: view attendance for a specific session
router.get(
  '/session/:id',
  protect,
  authorise('teacher'),
  [param('id').isMongoId().withMessage('Invalid session ID')],
  validate,
  getSessionAttendance
);

module.exports = router;