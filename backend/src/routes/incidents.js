// src/routes/incidents.js
const express = require('express');
const { body } = require('express-validator');
const { getIncidents, reportIncident, getMyIncidents, updateVerification } = require('../controllers/incidentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Get all incidents (public)
router.get('/', getIncidents);

// Report incident (protected)
router.post(
  '/report',
  protect,
  [
    body('lat', 'Latitude is required').isFloat(),
    body('lng', 'Longitude is required').isFloat(),
    body('description', 'Description must be at least 5 characters').isLength({ min: 5 }),
    body('severity', 'Severity must be low, medium, or high').isIn(['low', 'medium', 'high']),
  ],
  reportIncident
);

// Get user's incidents (protected)
router.get('/my-incidents', protect, getMyIncidents);

// Allow user to toggle verification of their own report
router.patch(
  '/:id/verify',
  protect,
  [body('verified').isBoolean().withMessage('verified must be boolean')],
  require('../controllers/incidentController').updateVerification
);

module.exports = router;
