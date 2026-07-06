const express = require('express');
const { body } = require('express-validator');
const {
  createSession,
  endSession,
  getActiveSession,
  getSessionHistory,
} = require('../controllers/sessionController');
const { protect, authorise, requireOnboardingComplete } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// All session routes require authentication + teacher role
router.use(protect, authorise('teacher'), requireOnboardingComplete);

router.post(
  '/create',
  [body('subject').optional().trim().isLength({ max: 100 }).withMessage('Subject cannot exceed 100 characters')],
  validate,
  createSession
);

router.post(
  '/end',
  [body('sessionId').optional().isMongoId().withMessage('Invalid session ID')],
  validate,
  endSession
);

router.get('/active', getActiveSession);
router.get('/active/:subjectId', getActiveSession);
router.get('/history', getSessionHistory);

module.exports = router;
