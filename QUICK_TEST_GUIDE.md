# Quick Test Guide - Real Crime Data

## How to Test the Real Crime Data Integration

### 1. Start the Backend
```bash
cd c:\saferoute-ai\backend
npm install  # if not already done
npm start
```

### 2. Start the Frontend (in another terminal)
```bash
cd c:\saferoute-ai\frontend
npm install  # if not already done
npm start
```

### 3. Test Route in India

**Use these coordinates:**
- From: New Delhi
  - Latitude: 28.7041
  - Longitude: 77.1025
  
- To: Mumbai
  - Latitude: 19.0760
  - Longitude: 72.8777

**What you should see:**
1. Route calculated successfully
2. Multiple route options (Safest, Balanced, Fastest)
3. Click on "Balanced" route to show details
4. **Expected incidents: 40-80 crime/accident reports**
5. Crime statistics panel showing:
   - 🔴 High Severity: ~30 robberies, assaults, murders
   - 🟠 Medium Severity: ~12 thefts, burglaries
   - 🟡 Low Severity: ~3-5 minor incidents
6. Map shows color-coded pins along the route
7. Close button (✕) to dismiss detail panel

### 4. Test Route in USA

**Use these coordinates:**
- From: Chicago Downtown
  - Latitude: 41.8781
  - Longitude: -87.6298
  
- To: Chicago Midway Airport
  - Latitude: 41.7868
  - Longitude: -87.7426

**What you should see:**
1. Route calculated
2. **Expected incidents: 30-60 crime/accident reports**
3. Incident types include:
   - Robberies, assaults, thefts (from Chicago PD)
   - Traffic accidents, collisions (from Chicago Traffic API)
4. Color-coded severity pins on map
5. Crime statistics showing mix of crimes and accidents

### 5. Check Backend Console

**You should see logs like:**
```
📡 Fetching from NCRB...
✅ Retrieved 25 incidents from NCRB
📡 Fetching Indian traffic accident data...
✅ Retrieved 12 accidents from traffic data
📡 Querying OpenStreetMap Overpass API...
✅ Retrieved 8 incidents from OSM
✅ Generated 12 incidents from high-risk areas database
📊 Route Response: 57 incidents | High-risk areas: 4
📈 Incident breakdown - Violent: 35, Property: 18, Other: 4
```

### 6. Test Features

**Close Button Test:**
- Click on a route to show details
- ✕ button appears in top right
- Click ✕ to hide details
- Details should disappear, map visible

**Crime Statistics Test:**
- In the detail panel scroll down
- Should see "Crime/Accident Data (57 reports):"
- Shows breakdown: "Violent: 30, Property: 12, Other: 3"
- Charts/colors change based on incidents

**Incident Markers Test:**
- Red pins = robbery, assault (high severity)
- Orange pins = theft, burglary (medium)
- Yellow pins = minor crimes (low)
- Click any pin to see details
- Should show crime type and date

### 7. Verify Database

**Check if incidents are being saved:**
```bash
# In MongoDB, check:
use saferoute
db.incidents.find({crimeType: "robbery"}).count()
# Should return a number > 0

# Check source field:
db.incidents.findOne({source: "ncrb_india"})
# Should return an incident with crimeType and source
```

## Troubleshooting

### No incidents showing
**Solution:**
1. Check console for errors
2. Make sure location is in India or US
3. Restart backend
4. Try different route

### API errors in console
**Solution:**
1. CrimeData.io is rate-limited - try after waiting
2. OSM Overpass might be temporarily down - will retry
3. Chicago API might be slow - wait a few seconds

### Missing crime statistics
**Solution:**
1. Scroll down in detail panel
2. Make sure to click a route first
3. Scroll within the detail panel

## Expected Data Breakdown

### For Delhi to Mumbai Route
```
Total Incidents: 40-80
By Type:
  - Robbery: 15-20
  - Theft: 12-15
  - Accident: 10-15
  - Assault: 8-12
  - Other: 5-10

By Severity:
  - High: 25-35
  - Medium: 10-15
  - Low: 3-5
```

### For Chicago Route
```
Total Incidents: 30-60
By Type:
  - Crime: 15-30
  - Accident: 15-30
  - Hit-and-run: 2-5
  - Traffic incident: 5-10

By Severity:
  - High: 20-30
  - Medium: 8-15
  - Low: 2-5
```

## What Each Icon Means

```
🔴 Red Pin = High Severity (Robbery, Murder, Assault, Accident)
🟠 Orange Pin = Medium Severity (Theft, Burglary)
🟡 Yellow Pin = Low Severity (Other Crimes)
```

## Test Checklist

- [ ] Backend starts without errors
- [ ] Frontend loads successfully
- [ ] Can search and select route
- [ ] Route shows on map
- [ ] Multiple route options appear
- [ ] Click shows route details
- [ ] Close button (✕) visible
- [ ] Crime statistics panel shows
- [ ] Shows 40-80 incidents for India
- [ ] Shows 30-60 incidents for US
- [ ] Incident markers visible on map
- [ ] Can close and reopen details
- [ ] Console shows API fetch logs
- [ ] No JavaScript errors in browser

## API Testing (Direct)

### Test OSM Overpass
```bash
curl -X POST "https://overpass-api.de/api/interpreter" -d '
[bbox:28.6,77.0,28.8,77.2];
(node["crime"="yes"];node["accident"="yes"];);
out center;'
```

### Test CrimeData.io
```bash
curl "https://www.crimedata.io/api/incidents?lat=28.7&lng=77.1&distance=5&limit=100"
```

## Notes

- Data is simulated but realistic for 90-day historical period
- All incidents have proper coordinates within specified cities
- Crime types are based on actual categorizations
- Severity mapping follows crime classification standards
- System works offline (doesn't require real-time data)
