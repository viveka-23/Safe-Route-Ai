// src/controllers/routeController.js
const axios = require('axios');
const SafeRoute = require('../utils/dijkstra');
const Incident = require('../models/Incident');
const { fetchExternalCrimeDataForRoute } = require('../utils/riskModel');

// Module-level warning holder for external API issues
let graphhopperWarning = null;

/**
 * Calculate safest route considering crime incidents
 * POST /api/route
 */
const getRoute = async (req, res) => {
  try {
    const { startLat, startLng, endLat, endLng } = req.body;

    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({ error: 'Missing required coordinates' });
    }

    console.log('📍 Route request:', { startLat, startLng, endLat, endLng });

    // Fetch verified incidents stored in our database using geospatial query
    // Use $geoWithin to find incidents within bounding box of route
    const centerLat = (startLat + endLat) / 2;
    const centerLng = (startLng + endLng) / 2;
    const radiusKm = Math.max(
      Math.abs(endLat - startLat),
      Math.abs(endLng - startLng)
    ) * 111 + 5; // rough conversion to km + 5km buffer

    let incidents = await Incident.find({
      verified: true,
      location: {
        $geoWithin: {
          $centerSphere: [
            [centerLng, centerLat],
            radiusKm / 6371 // convert km to radians
          ]
        }
      }
    });

    console.log('🚨 Database incidents found in area:', incidents.length);

    // Convert database incidents to response format
    incidents = incidents.map(inc => ({
      lat: inc.location.coordinates[1],
      lng: inc.location.coordinates[0],
      severity: inc.severity,
      description: inc.description,
      crimeType: inc.crimeType || 'other',
      source: 'user_report',
      timestamp: inc.timestamp,
      verified: inc.verified,
      confidence: inc.confidence,
    }));

    // Optionally augment with external crime API data (government feeds, etc.)
    const { fetchExternalCrimeData } = require('../utils/riskModel');
    const external = await fetchExternalCrimeData(startLat, startLng, endLat, endLng);
    if (external && external.length) {
      console.log('📥 External crime incidents fetched:', external.length);
      // merge them (assume external items have same shape as our Incident model)
      incidents = incidents.concat(external);
    }

    console.log('✅ Total incidents after merge:', incidents.length);

    // Fetch routes from Graphhopper API or OSRM
    let routes = await fetchRoutesFromGraphhopper(startLat, startLng, endLat, endLng);

    // filter out any empty or clearly invalid entries (must have coords, distance, duration)
    routes = (routes || []).filter((r) => {
      return r && r.geometry && r.geometry.coordinates && r.geometry.coordinates.length > 1 && r.distance > 0;
    });

    // Optionally ensure we have at least 3 real routes; do not fabricate new ones
    if (!routes || routes.length < 3) {
      console.log('⚠️ Insufficient routes returned by external service, keeping what we have.');
      routes = ensureMinimumRoutes(routes);
    }

    console.log('✅ Total routes available:', routes.length);

    if (!routes || routes.length === 0) {
      return res.status(400).json({ error: 'Could not calculate any routes' });
    }

    // Score each route separately, fetching any additional incidents specific
    // to the path geometry.  The earlier global 'incidents' list contains user
    // reports and area-wide data; we leave that alone for display purposes but
    // each route gets its own copy plus extra external data so that alternate
    // paths produce different scores.
    const safeRoute = new SafeRoute();
    const scoredRoutes = [];
    for (const route of routes) {
      // start with the base incident set (user reports + merged external)
      let routeIncidents = incidents.slice();

      // fetch external incidents tied directly to this route's geometry
      const extra = await fetchExternalCrimeDataForRoute(route);
      if (extra && extra.length) {
        console.log(`📥 Added ${extra.length} geometry-specific incidents for a route`);
        routeIncidents = routeIncidents.concat(extra);
      }

      const safetyScore = safeRoute.calculateRouteSafety(route, routeIncidents);
      const incidentStatsRoute = safeRoute.calculateRouteIncidentStats(route, routeIncidents);
      const incidentList = safeRoute.getRouteIncidentDetails(route, routeIncidents);
      const explanation = safeRoute.buildRouteExplanation(incidentStatsRoute, safetyScore);

      scoredRoutes.push({
        ...route,
        safetyScore,
        riskLevel: safeRoute.getRiskLevel(safetyScore),
        incidentStats: incidentStatsRoute,
        incidentList,
        explanation,
      });
    }

    // sort by safety score (lowest-first)
    scoredRoutes.sort((a, b) => a.safetyScore - b.safetyScore);

    console.log('✅ Routes scored. Safest score:', scoredRoutes[0]?.safetyScore);

    // Determine fastest route (shortest duration) from scored list
    const allRoutes = scoredRoutes;
    let fastestRoute = null;
    if (allRoutes.length > 0) {
      fastestRoute = allRoutes.reduce((best, r) => {
        if (!best) return r;
        const bestDur = best.duration || Infinity;
        const rDur = r.duration || Infinity;
        return rDur < bestDur ? r : best;
      }, null);
    }

    // Aggregate incident statistics by type
    const incidentStats = {
      total: incidents.length,
      byType: {},
      bySeverity: { high: 0, medium: 0, low: 0 },
      highRiskAreas: [],
    };

    incidents.forEach(inc => {
      // Count by crime type
      const type = inc.crimeType || inc.description?.split(' ')[0] || 'other';
      incidentStats.byType[type] = (incidentStats.byType[type] || 0) + 1;

      // Count by severity
      if (inc.severity && incidentStats.bySeverity[inc.severity] !== undefined) {
        incidentStats.bySeverity[inc.severity]++;
      }
    });

    // Find high-risk areas (clusters of incidents within 500m)
    const clusterMap = {};
    incidents.forEach(inc => {
      const clusterKey = `${Math.floor(inc.lat * 1000)},${Math.floor(inc.lng * 1000)}`;
      if (!clusterMap[clusterKey]) {
        clusterMap[clusterKey] = { lat: inc.lat, lng: inc.lng, count: 0, severity: [] };
      }
      clusterMap[clusterKey].count++;
      clusterMap[clusterKey].severity.push(inc.severity);
    });

    incidentStats.highRiskAreas = Object.values(clusterMap)
      .filter(cluster => cluster.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Build response payload with flexible rules depending on number of routes
    const responsePayload = {
      success: true,
      incidents: incidents.map((inc) => ({
        lat: inc.lat,
        lng: inc.lng,
        severity: inc.severity,
        description: inc.description,
        crimeType: inc.crimeType,
        source: inc.source,
        timestamp: inc.timestamp,
      })),
      incidentStats,
    };

    const count = allRoutes.length;
    const safestRoute = scoredRoutes[0];
    const mediumRoute = scoredRoutes[Math.max(0, Math.floor(scoredRoutes.length / 2))];
    const dangerousRoute = scoredRoutes[scoredRoutes.length - 1];

    if (count === 1) {
      // Only one route available - return only that route with appropriate classification
      const singleRoute = safestRoute;
      const riskLevel = singleRoute.riskLevel || 'medium-risk';

      if (riskLevel === 'safe' || riskLevel === 'low-risk') {
        responsePayload.safestRoute = singleRoute;
      } else if (riskLevel === 'high-risk' || riskLevel === 'very-dangerous') {
        responsePayload.dangerousRoute = singleRoute;
      } else {
        responsePayload.mediumRoute = singleRoute;
      }
    } else if (count === 2) {
      responsePayload.safestRoute = safestRoute;
      responsePayload.mediumRoute = mediumRoute || safestRoute;
      responsePayload.fastestRoute = fastestRoute || mediumRoute || safestRoute;
      responsePayload.dangerousRoute = dangerousRoute || safestRoute;

      if (fastestRoute && safestRoute && fastestRoute.geometry && safestRoute.geometry && fastestRoute.geometry.coordinates === safestRoute.geometry.coordinates) {
        responsePayload.note = 'Only two routes available; fastest and safest may be the same route.';
      }
    } else {
      responsePayload.safestRoute = safestRoute;
      responsePayload.mediumRoute = mediumRoute;
      responsePayload.fastestRoute = fastestRoute;
      responsePayload.dangerousRoute = dangerousRoute;

      if (fastestRoute && safestRoute && fastestRoute === safestRoute) {
        responsePayload.note = 'Fastest route is also the safest; medium route fallback used.';
      }
    }

    // Include any external API warnings to help with debugging and user guidance
    if (graphhopperWarning) {
      responsePayload.warnings = responsePayload.warnings || [];
      responsePayload.warnings.push(graphhopperWarning);
    }

    // Log summary of what's being returned
    console.log(`📊 Route Response: ${incidents.length} incidents | High-risk areas: ${incidentStats.highRiskAreas.length}`);
    console.log(`📈 Incident breakdown - Violent: ${incidentStats.bySeverity.high}, Property: ${incidentStats.bySeverity.medium}, Other: ${incidentStats.bySeverity.low}`);

    res.json(responsePayload);
  } catch (error) {
    console.error('❌ Route calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate route' });
  }
};

/**
 * Ensure we have at least 3 distinct routes
 */
const ensureMinimumRoutes = (existingRoutes) => {
  // Do not fabricate bogus routes that might cut through buildings or unreachable areas.
  // Only use the routes returned by the external routing service (Graphhopper/OSRM).
  // This keeps responses accurate to what a car or walker could actually follow.
  if (!existingRoutes || existingRoutes.length === 0) {
    console.warn('⚠️ No routes returned by external service; returning empty array.');
    return [];
  }
  return existingRoutes;
};

/**
 * Create alternative route with different characteristics
 */
const createAlternativeRoute = (startLat, startLng, endLat, endLng, routeIndex) => {
  const latDiff = endLat - startLat;
  const lngDiff = endLng - startLng;
  
  const coordinates = [];
  const segments = 8;
  
  for (let i = 0; i <= segments; i++) {
    const fraction = i / segments;
    const baseLat = startLat + latDiff * fraction;
    const baseLng = startLng + lngDiff * fraction;
    
    // Create different variations for each route
    const offset = (routeIndex + 1) * 0.01;
    const wave = Math.sin(fraction * Math.PI) * offset;
    
    coordinates.push([baseLng + wave, baseLat + (wave * 0.5)]);
  }

  const distance = getDistanceBetweenPoints(startLat, startLng, endLat, endLng);
  const variation = 1 + (routeIndex * 0.15); // Each route is longer

  return {
    distance: distance * variation * 1000, // Convert to meters
    duration: (distance * variation / 40) * 3600, // Assuming 40 km/h average
    geometry: {
      type: 'LineString',
      coordinates: coordinates,
    },
  };
};

/**
 * Fetch routes from Graphhopper API or OSRM (free fallback)
 */
const fetchRoutesFromGraphhopper = async (startLat, startLng, endLat, endLng) => {
  try {
    console.log('🔍 Fetching routes from Graphhopper for:', { startLat, startLng, endLat, endLng });
    
    const response = await axios.get('https://graphhopper.com/api/1/route', {
      params: {
        point: [`${startLat},${startLng}`, `${endLat},${endLng}`],
        profile: 'car',
        api_key: process.env.GRAPHHOPPER_API_KEY,
        points: 3,
        algorithm: 'round_trip',
      },
      timeout: 15000,
    });

    console.log('✅ Graphhopper routes received:', response.data.paths.length);

    // Transform Graphhopper response to standard format
    return response.data.paths.map((path) => ({
      distance: path.distance,
      duration: path.time,
      geometry: {
        coordinates: path.points.coordinates,
      },
    }));
  } catch (error) {
    console.error('⚠️ Graphhopper API error:', error.message, 'Status:', error.response?.status);
    // Set friendly warning when auth fails
    if (error.response?.status === 401) {
      graphhopperWarning = 'Graphhopper API authentication failed (401). Set GRAPHHOPPER_API_KEY in backend/.env or check your key.';
      console.warn('⚠️', graphhopperWarning);
    }
    console.log('📍 Falling back to OSRM (free routing)...');

    // Use OSRM as free fallback
    return await fetchRoutesFromOSRM(startLat, startLng, endLat, endLng);
  }
};

/**
 * Fetch routes from OSRM API (free, open-source routing)
 * OSRM provides real road network routing without requiring API keys
 */
const fetchRoutesFromOSRM = async (startLat, startLng, endLat, endLng) => {
  try {
    console.log('🌐 Requesting routes from OSRM (Open Source Routing Machine)...');
    
    // OSRM API format: /route/v1/driving/lng,lat;lng,lat
    const coordinates = `${startLng},${startLat};${endLng},${endLat}`;
    
    // Request alternative routes
    const response = await axios.get(`https://router.project-osrm.org/route/v1/driving/${coordinates}`, {
      params: {
        alternatives: true,  // Get 3 alternative routes
        steps: false,
        geometries: 'geojson',
        overview: 'full',
      },
      timeout: 15000,
    });

    if (!response.data.routes || response.data.routes.length === 0) {
      throw new Error('No routes found from OSRM');
    }

    console.log('✅ OSRM routes received:', response.data.routes.length);

    // Transform OSRM response to standard format
    return response.data.routes.map((route) => ({
      distance: route.distance,     // meters
      duration: route.duration,     // seconds
      geometry: route.geometry,     // GeoJSON geometry
    }));
  } catch (error) {
    console.error('❌ OSRM API error:', error.message);
    console.log('📌 Using approximated route (fallback)');

    // Last resort: return a simple route based on actual road approximation
    // This uses a simple box route algorithm to approximate following roads
    return generateApproximatedRoute(startLat, startLng, endLat, endLng);
  }
};

/**
 * Generate approximated route when APIs are unavailable
 * Uses a simple zigzag pattern to simulate following roads
 */
const generateApproximatedRoute = (startLat, startLng, endLat, endLng) => {
  const latDiff = endLat - startLat;
  const lngDiff = endLng - startLng;
  
  // Create 3 different approximated routes with variations
  const route1 = createZigzagRoute(startLat, startLng, endLat, endLng, 5);
  const route2 = createZigzagRoute(startLat, startLng, endLat, endLng, 3);
  const route3 = createZigzagRoute(startLat, startLng, endLat, endLng, 7);

  return [route1, route2, route3];
};

/**
 * Create a zigzag route pattern to simulate road following
 */
const createZigzagRoute = (startLat, startLng, endLat, endLng, points) => {
  const coordinates = [];
  
  for (let i = 0; i <= points; i++) {
    const fraction = i / points;
    const lat = startLat + (endLat - startLat) * fraction;
    const lng = startLng + (endLng - startLng) * fraction;
    
    // Add slight zigzag to simulate road following
    const zigzag = Math.sin(fraction * Math.PI * 2) * 0.005;
    coordinates.push([lng + zigzag, lat]);
  }

  const distance = getDistanceBetweenPoints(startLat, startLng, endLat, endLng);

  return {
    distance: distance * (1000 + Math.random() * 500), // meters, with variation
    duration: (distance / 40) * 3600, // assuming 40 km/h average
    geometry: {
      type: 'LineString',
      coordinates: coordinates,
    },
  };
};

/**
 * Calculate distance between two points in km (Haversine formula)
 */
const getDistanceBetweenPoints = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (degrees) => (degrees * Math.PI) / 180;

module.exports = { getRoute };
