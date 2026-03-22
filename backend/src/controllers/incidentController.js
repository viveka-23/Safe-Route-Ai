// src/controllers/incidentController.js
const Incident = require('../models/Incident');
const { validationResult } = require('express-validator');
const { verifyIncidentReport } = require('../utils/ai-verification');

/**
 * Get all incidents or filter by location
 * GET /api/incidents
 */
const getIncidents = async (req, res) => {
  try {

    const { lat, lng, radius = 5 } = req.query;
    let query = { verified: true };

    if (lat && lng) {
      // Find incidents within radius (in km)
      const radiusInMeters = radius * 1000;
      query.location = {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(lng), parseFloat(lat)],
            radiusInMeters / 6371000,
          ],
        },
      };
    }

    let incidents = await Incident.find(query)
      .select('-userId')
      .sort({ timestamp: -1 })
      .limit(100);

    // flatten coordinates so frontend can access lat/lng directly
    incidents = incidents.map((inc) => {
      const [lng, lat] = inc.location?.coordinates || [null, null];
      return {
        _id: inc._id,
        lat,
        lng,
        description: inc.description,
        severity: inc.severity,
        verified: inc.verified,
        confidence: inc.confidence,
        timestamp: inc.timestamp,
        userId: inc.userId,
      };
    });

    res.json({
      success: true,
      count: incidents.length,
      data: incidents,
    });
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
};

/**
 * Report an incident
 * POST /api/report
 */
const reportIncident = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { lat, lng, description, severity } = req.body;
    const userId = req.userId;

    // Verify incident using AI
    const { verified, confidence } = await verifyIncidentReport(description);

    // Create incident with GeoJSON location
    const incident = new Incident({
      userId,
      location: {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)],
      },
      description,
      severity,
      verified,
      confidence,
    });

    await incident.save();

    // Populate user details for response
    await incident.populate('userId', 'name email');

    // Broadcast new incident via Socket.io
    if (req.io) {
      req.io.emit('new_incident', {
        id: incident._id,
        location: incident.location,
        description: incident.description,
        severity: incident.severity,
        verified: incident.verified,
        confidence: incident.confidence,
        timestamp: incident.timestamp,
        reporter: incident.userId.name,
      });
    }

    res.status(201).json({
      success: true,
      verified,
      confidence,
      incident,
    });
  } catch (error) {
    console.error('Report incident error:', error);
    res.status(500).json({ error: 'Failed to report incident' });
  }
};

/**
 * Get user's reported incidents
 * GET /api/my-incidents
 */
const getMyIncidents = async (req, res) => {
  try {
    const userId = req.userId;

    let incidents = await Incident.find({ userId })
      .sort({ timestamp: -1 });

    incidents = incidents.map((inc) => {
      const [lng, lat] = inc.location?.coordinates || [null, null];
      return {
        _id: inc._id,
        lat,
        lng,
        description: inc.description,
        severity: inc.severity,
        verified: inc.verified,
        confidence: inc.confidence,
        timestamp: inc.timestamp,
      };
    });

    res.json({
      success: true,
      count: incidents.length,
      data: incidents,
    });
  } catch (error) {
    console.error('Get my incidents error:', error);
    res.status(500).json({ error: 'Failed to fetch your incidents' });
  }
};



/**
 * Allow a user to update their own incident's verification flag.
 * PATCH /api/incidents/:id/verify
 * body: { verified: Boolean }
 */
const updateVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const { verified } = req.body;
    const userId = req.userId;

    if (typeof verified !== 'boolean') {
      return res.status(400).json({ error: 'Verified must be boolean' });
    }

    const incident = await Incident.findById(id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    if (incident.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to modify this incident' });
    }

    incident.verified = verified;
    await incident.save();

    // format for frontend
    const [lng, lat] = incident.location?.coordinates || [null, null];
    res.json({
      success: true,
      incident: {
        _id: incident._id,
        lat,
        lng,
        description: incident.description,
        severity: incident.severity,
        verified: incident.verified,
        confidence: incident.confidence,
        timestamp: incident.timestamp,
      },
    });
  } catch (error) {
    console.error('Update verification error:', error);
    res.status(500).json({ error: 'Failed to update verification' });
  }
};

module.exports = {
  getIncidents,
  reportIncident,
  getMyIncidents,
  updateVerification,
};
