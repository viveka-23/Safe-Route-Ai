// src/utils/dijkstra.js

/**
 * Modified Dijkstra Algorithm for Safety-Based Routing
 * Edge weights include: distance, crime density, time-of-day risk
 */

class SafeRoute {
  constructor() {
    this.nodes = {};
  }

  /**
   * Calculate safety score for a route segment
   * @param {number} distance - Distance in km
   * @param {number} crimeWeight - Weighted crime incidents in area
   * @param {number} timeRiskFactor - Risk factor based on time of day (0.8 - 1.2)
   */
  calculateSegmentWeight(distance, crimeWeight = 0, timeRiskFactor = 1) {
    // Weight formula: distance + (crime density penalty)
    // Crime weight is normalized 0-1, multiplied by distance for impact
    const crimeImpact = crimeWeight * distance * 0.5;
    const timeImpact = (timeRiskFactor - 1) * distance * 0.3;

    return distance + crimeImpact + timeImpact;
  }

  /**
   * Apply time decay to reduce weight of older incidents
   * Recent incidents weighted 1.0, 30+ days old weighted 0.3
   */
  calculateTimeDecay(incidentTimestamp) {
    const daysAgo = (Date.now() - new Date(incidentTimestamp).getTime()) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.max(0.3, 1 - daysAgo / 30);
    return decayFactor;
  }

  /**
   * Get crime type severity multiplier
   * Different crime types have different safety impacts
   */
  getCrimeTypeWeight(crimeType) {
    const crimeWeights = {
      // Violent crimes - highest impact (1.5x+)
      'robbery': 1.5,
      'assault': 1.4,
      'rape': 1.6,
      'murder': 1.8,
      'homicide': 1.8,
      'kidnapping': 1.7,
      'dacoity': 1.6,
      'rioting': 1.3,

      // Traffic/Accidents - moderate impact (1.0x)
      'accident': 1.0,
      'hit-and-run': 1.1,
      'multi-vehicle-crash': 1.0,

      // Property crimes - lower impact (0.6x)
      'theft': 0.6,
      'burglary': 0.7,
      'motor-vehicle-theft': 0.8,
      'shoplifting': 0.5,
      'pickpocketing': 0.5,
      'criminal-breach': 0.6,
      'cheating': 0.4,
      'forgery': 0.4,

      // Other - baseline (0.5x)
      'harassment': 0.5,
      'trespassing': 0.4,
      'other': 0.5,
    };
    return crimeWeights[crimeType] || crimeWeights['other'];
  }

  /**
   * Calculate route safety based on incident proximity
   * Lower score = safer route
   */
  calculateRouteSafety(route, incidents = []) {
    if (!route.geometry) return 0;

    const coordinates = route.geometry.coordinates || [];
    if (coordinates.length === 0) return 0;

    let totalCrimeDensity = 0;
    let violentCrimeScore = 0;
    let incidentsWithinRoute = [];

    // Calculate weighted crime density for each coordinate
    coordinates.forEach((coord) => {
      incidents.forEach((incident) => {
        const distance = this.haversineDistance(coord, [incident.lng, incident.lat]);

        // Consider incidents within 1.5km of route
        if (distance <= 1.5) {
          // Apply time decay for older incidents
          const timeDecay = incident.timestamp ? this.calculateTimeDecay(incident.timestamp) : 0.8;

          // Get crime type weight
          const crimeWeight = this.getCrimeTypeWeight(incident.crimeType);

          // Severity weight
          const severityWeight = {
            high: 1.5,
            medium: 0.8,
            low: 0.3,
          }[incident.severity] || 0.5;

          // Proximity weight (closer = higher impact)
          const proximityWeight = Math.max(0.2, 1 - distance / 1.5);

          // Combined score for this incident
          const incidentScore = severityWeight * crimeWeight * timeDecay * proximityWeight;
          totalCrimeDensity += incidentScore;

          // Track violent crimes separately
          if (incident.severity === 'high' && (incident.crimeType?.includes('rob') || incident.crimeType?.includes('assault') || incident.crimeType?.includes('rape') || incident.crimeType?.includes('murder'))) {
            violentCrimeScore += incidentScore * 2;
          }

          incidentsWithinRoute.push({
            ...incident,
            distanceFromRoute: distance,
            riskContribution: incidentScore,
          });
        }
      });
    });

    // Normalize crime density over route length
    const distance = (route.distance || 1) / 1000; // convert to km
    const normalizedCrimeDensity = totalCrimeDensity / (distance || 1);

    // Base safety score
    let safetyScore = normalizedCrimeDensity * 100;

    // Add violent crime penalty
    safetyScore += violentCrimeScore * 50;

    // Apply the deterministic risk score from severity engine
    try {
      const { predictRiskScore } = require('./riskModel');
      const riskAdjustment = predictRiskScore(route, incidents);
      if (typeof riskAdjustment === 'number' && !isNaN(riskAdjustment)) {
        safetyScore += riskAdjustment * 0.5; // weight it appropriately
      }
    } catch (err) {
      console.log('⚠️ Could not apply predictRiskScore:', err.message);
    }

    return Math.max(0, safetyScore);
  }

  /**
   * Calculate crime density near a coordinate - Enhanced
   * Considers severity, crime type, time decay, and proximity
   */
  calculateLocalCrimeDensity(coord, incidents = []) {
    const RADIUS_KM = 1.5; // 1.5km radius
    let densityScore = 0;

    incidents.forEach((incident) => {
      const distance = this.haversineDistance(coord, [incident.lng, incident.lat]);

      if (distance <= RADIUS_KM) {
        // Apply time decay
        const timeDecay = incident.timestamp ? this.calculateTimeDecay(incident.timestamp) : 0.8;

        // Severity weight
        const severityWeight = {
          low: 0.3,
          medium: 0.6,
          high: 1.0,
        }[incident.severity] || 0.5;

        // Crime type weight
        const crimeWeight = this.getCrimeTypeWeight(incident.crimeType);

        // Proximity impact (closer = higher score)
        const proximityWeight = Math.max(0.2, 1 - distance / RADIUS_KM);

        // Combined score
        densityScore += severityWeight * crimeWeight * timeDecay * proximityWeight;
      }
    });

    // Normalize to 0-1 scale
    return Math.min(densityScore, 1.0);
  }

  /**
   * Find safest route using modified Dijkstra
   * @param {Object} startPoint - {lat, lng}
   * @param {Object} endPoint - {lat, lng}
   * @param {Array} availableRoutes - Array of route options from API
   * @param {Array} incidents - Array of incident objects with location and severity
   */
  findSafeRoute(startPoint, endPoint, availableRoutes = [], incidents = []) {
    if (!availableRoutes || availableRoutes.length === 0) {
      return null;
    }

    // Score each route based on crime incidents
    const scoredRoutes = availableRoutes.map((route) => {
      const safetyScore = this.calculateRouteSafety(route, incidents);
      // calculate incident statistics and human-readable explanation
      const incidentStats = this.calculateRouteIncidentStats(route, incidents);
      const incidentList = this.getRouteIncidentDetails(route, incidents);
      const explanation = this.buildRouteExplanation(incidentStats, safetyScore);
      return {
        ...route,
        safetyScore,
        riskLevel: this.getRiskLevel(safetyScore),
        incidentStats,
        incidentList,
        explanation,
      };
    });

    // Sort by safety score (lower is safer)
    scoredRoutes.sort((a, b) => a.safetyScore - b.safetyScore);

    return {
      safestRoute: scoredRoutes[0],
      mediumRoute: scoredRoutes[Math.floor(scoredRoutes.length / 2)],
      dangerousRoute: scoredRoutes[scoredRoutes.length - 1],
      allRoutes: scoredRoutes,
    };
  }

  /**
   * Haversine distance formula - calculates distance between two lat/lng points
   */
  haversineDistance(coord1, coord2) {
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;

    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  /**
   * Determine risk level based on safety score
   * Score ranges from 0 (safest) to higher values (more dangerous)
   */
  getRiskLevel(safetyScore) {
    if (safetyScore < 10) return 'safe';
    if (safetyScore < 30) return 'low-risk';
    if (safetyScore < 60) return 'medium-risk';
    if (safetyScore < 100) return 'high-risk';
    return 'very-dangerous';
  }

  /**
   * Calculate incident counts by severity for a route
   */
  calculateRouteIncidentStats(route, incidents = []) {
    const coords = route.geometry?.coordinates || [];
    const stats = {
      total: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    const seen = new Set(); // avoid counting same incident multiple times

    coords.forEach((coord) => {
      incidents.forEach((inc) => {
        const key = `${inc.lat},${inc.lng}`;
        if (seen.has(key)) return;
        const distance = this.haversineDistance([inc.lng, inc.lat], coord);
        if (distance <= 1) { // within 1 km
          stats.total += 1;
          stats[inc.severity] = (stats[inc.severity] || 0) + 1;
          seen.add(key);
        }
      });
    });

    return stats;
  }

  /**
   * Return list of incidents near a route (within 1 km) with details
   */
  getRouteIncidentDetails(route, incidents = []) {
    const coords = route.geometry?.coordinates || [];
    const nearby = [];
    const seen = new Set();

    coords.forEach((coord) => {
      incidents.forEach((inc) => {
        const key = `${inc.lat},${inc.lng}`;
        if (seen.has(key)) return;
        const distance = this.haversineDistance([inc.lng, inc.lat], coord);
        if (distance <= 1) {
          nearby.push({
            lat: inc.lat,
            lng: inc.lng,
            severity: inc.severity,
            description: inc.description,
            timestamp: inc.timestamp,
          });
          seen.add(key);
        }
      });
    });

    return nearby;
  }

  /**
   * Build a human-readable explanation from stats and score
   */
  buildRouteExplanation(stats, safetyScore) {
    if (!stats || stats.total === 0) {
      return 'No reported incidents near this route; considered safe.';
    }

    const parts = [];
    if (stats.high) parts.push(`${stats.high} high-severity`);
    if (stats.medium) parts.push(`${stats.medium} medium-severity`);
    if (stats.low) parts.push(`${stats.low} low-severity`);

    let text = `Route passes near ${stats.total} reported incident` + (stats.total > 1 ? 's' : '');
    if (parts.length) {
      text += ` (${parts.join(', ')})`;
    }
    text += `.`;

    // Add safety classification
    const level = this.getRiskLevel(safetyScore);
    const riskDescriptions = {
      'safe': 'This is the safest available route with minimal reported incidents.',
      'low-risk': 'This route has low crime risk - generally safe to travel.',
      'medium-risk': 'This route has moderate risks; consider comparing with alternatives.',
      'high-risk': 'This route has notable crime concerns; safer alternatives available.',
      'very-dangerous': 'This route poses significant safety risks; strongly consider alternatives.',
    };

    text += ' ' + (riskDescriptions[level] || 'Safety classification unavailable.');
    return text;
  }
}

module.exports = SafeRoute;
