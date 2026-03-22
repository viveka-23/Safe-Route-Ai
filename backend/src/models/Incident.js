// src/models/Incident.js
const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function (v) {
          return v.length === 2;
        },
        message: 'Coordinates must be [lng, lat] array',
      },
    },
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    minlength: 5,
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  reports: {
    type: Number,
    default: 1,
  },
  crimeType: {
    type: String,
    enum: [
      'robbery', 'theft', 'assault', 'harassment', 'accident', 'burglary',
      'kidnapping', 'rape', 'dacoity', 'rioting', 'criminal breach',
      'murder', 'homicide', 'arson', 'hit-and-run', 'motor-vehicle-theft',
      'shoplifting', 'pickpocketing', 'cheating', 'forgery', 'other'
    ],
    default: 'other',
  },
  source: {
    type: String,
    enum: [
      'user_report', 'crimedata.io', 'chicago_pd', 'chicago_traffic',
      'ncrb_india', 'traffic_rto', 'osm_overpass', 'here_traffic_api',
      'osm_accident_data', 'high_risk_area_db', 'india_crime_data'
    ],
    default: 'user_report',
  },
});


// Geospatial index for nearby queries
incidentSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Incident', incidentSchema);
