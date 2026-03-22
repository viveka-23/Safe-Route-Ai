// src/routes/routes.js
const express = require('express');
const { body } = require('express-validator');
const { getRoute } = require('../controllers/routeController');
const { trainRiskModel } = require('../utils/riskModel');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Calculate route with safety scoring
router.post(
  '/calculate',
  protect,
  [
    body('startLat', 'Start latitude is required').isFloat(),
    body('startLng', 'Start longitude is required').isFloat(),
    body('endLat', 'End latitude is required').isFloat(),
    body('endLng', 'End longitude is required').isFloat(),
  ],
  getRoute
);

// Train the ML model on historical incident data (can be called periodically)
router.post('/train-model', protect, async (req, res) => {
  try {
    console.log('📚 Training model endpoint called...');
    const weights = await trainRiskModel();
    res.json({
      success: true,
      message: 'Model trained successfully',
      weights,
    });
  } catch (error) {
    console.error('Training error:', error);
    res.status(500).json({ error: 'Failed to train model' });
  }
});

module.exports = router;

