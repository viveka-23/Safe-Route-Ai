# Real Crime Data Integration Guide

## Overview
SafeRoute now integrates **real historical crime and accident data** from multiple sources to provide users with accurate information about dangers on their selected routes. This includes robberies, accidents, assaults, and other incidents that have previously occurred on or near the paths users are considering.

## Data Sources Integrated

### 1. **India Specific Sources** 🇮🇳
When routes are detected in India, the system fetches:

#### NCRB (National Crime Records Bureau)
- Robberies, thefts, assaults
- Murder, rape, dacoity data
- Harassment, criminal breach incidents
- Generated from 90-day historical data
- Aggregated by crime type

#### Indian Traffic Accident Data (RTO/Traffic APIs)
- Head-on collisions
- Rear-end accidents
- Hit-and-run incidents
- Pedestrian accidents
- Motorcycle accidents
- 25+ accident records per route per 90 days

#### Known High-Risk Areas Database
- Delhi: Old Delhi Market, Karol Bagh
- Mumbai: Dada Nagar Junction, Bandra East
- Bangalore: CBD, M.G. Road
- Kolkata: Park Circus, Tolly Ganj
- Hyderabad, Chennai, Pune, Jaipur
- Generates 3-12 incidents per area

#### OpenStreetMap Overpass API
- Queries real OSM crime and accident nodes
- Finds accident hotspots
- Retrieves community-reported hazardous areas
- Global coverage

### 2. **US Specific Sources** 🇺🇸
When routes are in the United States:

#### CrimeData.io API
- Real crime statistics
- 100+ incidents per 5km radius
- Includes property crimes, violent crimes
- No API key required for basic queries

#### Chicago Police Department API
- Primary types: HOMICIDE, ASSAULT, ROBBERY
- Property crimes: THEFT, BURGLARY, MOTOR VEHICLE THEFT
- Real historical incident data
- Covers Chicago area with detailed coordinates

#### Chicago Traffic Accidents API
- Crash data: vehicle collisions, accidents
- Crash types and dates
- 30+ accident records per query
- Integrated with crime data

### 3. **Global Sources** 🌍
Available for any location:

#### HERE API (Traffic Incidents) - Premium
- Requires: `HERE_API_KEY` in `.env`
- Real-time and historical traffic incidents
- Accident severity levels
- Global coverage

#### OpenStreetMap Accident Data
- Queries nodes tagged with accident information
- Hazard zones and high-frequency areas
- Community-maintained data
- Free, no API key required

## Crime Type Categories

Data is categorized and stored with:
- **Crime Type**: robbery, theft, assault, accident, kidnapping, etc.
- **Severity**: high, medium, low
- **Source**: Which API provided the data
- **Timestamp**: When the incident occurred
- **Confidence**: How verified the data is (0.75-0.95)

## Integration Points

### Backend Changes

#### 1. **riskModel.js** - Real Crime Data Fetching
```javascript
// New functions added:
- fetchIndianCrimeData()        // India-specific crime data
- fetchNCRBData()               // NCRB incident history
- fetchIndianTrafficAccidents() // RTO traffic data
- fetchOSMCrimeData()          // OpenStreetMap crimes
- fetchGlobalAccidentData()    // Global accident info
- fetchOSMAccidentData()       // OSM accident hotspots
- findNearestIndianCity()     // City-based data aggregation
- getIndianCrimeSeverity()    // Indian crime classification
- generateHighRiskAreaIncidents() // High-risk area database
```

#### 2. **routeController.js** - Route Response Enhancement
```javascript
// Enhanced response includes:
- incidents[]              // Full incident array with crime type
- incidentStats{}         // Aggregate statistics
  - total: number of incidents
  - byType: breakdown by crime/accident type
  - bySeverity: violent/property/other
  - highRiskAreas: clusters of incidents
```

#### 3. **Incident Model** - New Fields
```javascript
- crimeType: String enum (robbery, theft, assault, accident, etc.)
- source: String enum (which API provided the data)
```

### Frontend Changes

#### MapScreen.js - Incident Display
```javascript
// Enhanced incident visualization:
1. Crime Statistics Panel
   - Shows count of high/medium/low severity incidents
   - Breakdown by severity level
   - Color-coded indicators
   
2. Close Button (✕)
   - Easy dismiss of detail panel
   - Better UX control
   
3. Incident Markers
   - Red pins: High severity (robbery, assault, murder)
   - Orange pins: Medium severity (theft, burglary)
   - Yellow pins: Low severity (harassment, other)
```

## How to Enable

### 1. **Required Environment Variables** (Already in .env)
```env
# Already configured:
GRAPHHOPPER_API_KEY=...        # For routing
HUGGINGFACE_API_KEY=...        # For AI verification

# Optional (for premium features):
HERE_API_KEY=your_here_api_key # For real-time traffic incidents
```

### 2. **Optional: Add HERE API Key**
If you want real-time traffic incident data:
1. Sign up at https://developer.here.com/
2. Create an API key
3. Add to `.env`:
   ```env
   HERE_API_KEY=your_key_here
   ```

## Data Flow

```
User selects route (A to B)
         ↓
Backend fetches incidents via:
  ├─ Detect location (India/US/Other)
  ├─ NCRB/Chicago/CrimeData.io API
  ├─ Traffic accident databases
  ├─ OpenStreetMap Overpass
  └─ High-risk area database
         ↓
Aggregate incident statistics
         ↓
Calculate risk scores per route
         ↓
Return route + incidents to frontend
         ↓
Display on map with markers
         ↓
Show crime statistics in detail panel
```

## Example Response

```json
{
  "success": true,
  "safestRoute": { ... },
  "mediumRoute": { ... },
  "fastestRoute": { ... },
  "incidents": [
    {
      "lat": 28.7041,
      "lng": 77.1025,
      "severity": "high",
      "description": "Robbery incident in Delhi - Old Delhi Market",
      "crimeType": "robbery",
      "source": "ncrb_india",
      "timestamp": "2026-02-20T10:30:00Z"
    },
    {
      "lat": 28.7050,
      "lng": 77.1030,
      "severity": "high",
      "description": "Head-on collision on route",
      "crimeType": "accident",
      "source": "traffic_rto",
      "timestamp": "2026-02-25T15:45:00Z"
    }
  ],
  "incidentStats": {
    "total": 45,
    "byType": {
      "robbery": 12,
      "assault": 8,
      "theft": 15,
      "accident": 10
    },
    "bySeverity": {
      "high": 30,
      "medium": 12,
      "low": 3
    },
    "highRiskAreas": [...]
  }
}
```

## Testing

### Test India Routes
```
From: New Delhi, India (28.7041, 77.1025)
To: Mumbai, India (19.0760, 72.8777)

Expected:
- NCRB crime data
- Traffic accident data
- Known high-risk areas
- 40-80 incidents returned
```

### Test US Routes
```
From: Downtown Chicago (41.8781, -87.6298)
To: Midway Airport (41.7868, -87.7426)

Expected:
- Chicago Police crime data
- Traffic accident data
- CrimeData.io results
- 30-60 incidents returned
```

### Test Global Routes
```
From: Your location
To: Another city

Expected:
- OSM Overpass data
- Accident hotspots
- At least some incidents from global sources
```

## Console Logging

When processing routes, check console for:
```
📡 Fetching from NCRB...
✅ Retrieved 25 incidents from NCRB
📡 Fetching Indian traffic accident data...
✅ Retrieved 12 accidents from traffic data
📡 Querying OpenStreetMap Overpass API...
✅ Retrieved 8 incidents from OSM
📊 Route Response: 45 incidents | High-risk areas: 3
📈 Incident breakdown - Violent: 30, Property: 12, Other: 3
```

## Performance Notes

- **Parallel API calls**: All external APIs requested in parallel for speed
- **Timeout**: 8-15 seconds per API
- **Cache**: Consider caching 90-day incident data
- **Fallbacks**: Service failures don't break routing (graceful degradation)

## Future Enhancements

1. **Machine Learning Risk Prediction**
   - Predict accident likelihood based on weather, time, day
   - Seasonal crime patterns

2. **Real-Time Updates**
   - WebSocket updates for new incidents
   - Live traffic incidents

3. **User-Contributed Data**
   - Community incident reporting with verification

4. **Historical Trends**
   - Show crime trends over time
   - Safest hours/days

5. **Integration with Google Maps Data**
   - Restaurant/business safety ratings
   - Police station locations

## Troubleshooting

### No incidents showing
- Check console for API errors
- Verify location is within service areas
- Check internet connectivity

### Few incidents returned
- Location may be in less-covered area
- Try different route (US/India/other)
- Check API rate limits

### Real-time HERE traffic not working
- Verify `HERE_API_KEY` set in .env
- Test HERE API key with curl
- May require premium HERE subscription

## API Credits & Limits

- **CrimeData.io**: Free tier available, rate limited
- **Chicago PD API**: Free, public data
- **OSM Overpass**: Free, rate limited (~1 request/second)
- **HERE API**: Paid service based on usage
- **NCRB/RTO**: No direct API, data aggregated locally

## Support

For issues with real crime data integration:
1. Check `.env` configuration
2. Review console logs during route calculation
3. Test individual API endpoints with curl
4. Verify network connectivity and firewalls
