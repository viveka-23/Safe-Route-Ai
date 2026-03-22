# SafeRoute AI - API Documentation

Complete API reference for SafeRoute AI backend.

---

## 🔐 Authentication APIs

### Register User
**Endpoint:** `POST /api/auth/register`

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePassword123"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**Validation:**
- name: Required, trimmed
- email: Required, must be valid email, unique
- password: Required, minimum 6 characters

---

### Login User
**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**Error Responses:**
- 400: Invalid email or password format
- 401: Credentials don't match
- 500: Server error

---

## 📍 Incident APIs

### Report an Incident
**Endpoint:** `POST /api/incidents/report`

**Headers Required:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request:**
```json
{
  "lat": 40.7128,
  "lng": -74.0060,
  "description": "Armed robbery near the street intersection",
  "severity": "high"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "verified": true,
  "confidence": 0.92,
  "incident": {
    "_id": "507f1f77bcf86cd799439012",
    "userId": "507f1f77bcf86cd799439011",
    "lat": 40.7128,
    "lng": -74.0060,
    "description": "Armed robbery near the street intersection",
    "severity": "high",
    "verified": true,
    "confidence": 0.92,
    "timestamp": "2024-02-11T10:30:00Z"
  }
}
```

**Validation:**
- lat: Required, must be float
- lng: Required, must be float
- description: Required, minimum 5 characters
- severity: Required, must be 'low', 'medium', or 'high'

**What Happens:**
1. Description sent to HuggingFace API
2. Sentiment analysis determines if real crime
3. Confidence score calculated (0-1)
4. Incident saved to MongoDB
5. Broadcast to all connected Socket.io clients

---

### Get Verified Incidents
**Endpoint:** `GET /api/incidents`

**Query Parameters:**
```
lat=40.7128        (Optional: center latitude)
lng=-74.0060       (Optional: center longitude)
radius=5           (Optional: search radius in km, default 5)
```

**Examples:**
```
GET /api/incidents
GET /api/incidents?lat=40.7128&lng=-74.0060
GET /api/incidents?lat=40.7128&lng=-74.0060&radius=10
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "lat": 40.7128,
      "lng": -74.0060,
      "description": "Armed robbery near intersection",
      "severity": "high",
      "verified": true,
      "confidence": 0.92,
      "timestamp": "2024-02-11T10:30:00Z",
      "reports": 2
    },
    {
      "_id": "507f1f77bcf86cd799439013",
      "lat": 40.7150,
      "lng": -74.0070,
      "description": "Car theft incident",
      "severity": "medium",
      "verified": true,
      "confidence": 0.78,
      "timestamp": "2024-02-11T09:15:00Z",
      "reports": 1
    }
  ]
}
```

**Notes:**
- Only verified incidents returned
- Sorted by most recent first
- Maximum 100 results returned
- Uses geospatial index for efficiency

---

### Get My Reported Incidents
**Endpoint:** `GET /api/incidents/my-incidents`

**Headers Required:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "userId": "507f1f77bcf86cd799439011",
      "lat": 40.7128,
      "lng": -74.0060,
      "description": "Armed robbery",
      "severity": "high",
      "verified": true,
      "confidence": 0.92,
      "timestamp": "2024-02-11T10:30:00Z"
    }
  ]
}
```

**Notes:**
- Includes all incidents (verified and unverified)
- Sorted by most recent
- Only shows your own reports
- Requires authentication

---

## 🗺️ Route APIs

### Calculate Safe Route
**Endpoint:** `POST /api/routes/calculate`

**Headers Required:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request:**
```json
{
  "startLat": 40.7128,
  "startLng": -74.0060,
  "endLat": 40.7580,
  "endLng": -73.9855
}
```


---

### Updating Verification Flag

**PATCH** `/api/incidents/{id}/verify`  (authenticated)  
Body: `{ "verified": true }` or `{ "verified": false }`  
Allows a user to override the AI classification on their own report.

**Response (200):**
```json
{ "success": true, "incident": { /* updated incident object */ } }
```

**Response (200 OK):**

> Routes are evaluated using an internal crime-severity engine.  Each
> incident within ~1 km of a candidate path contributes a weighted risk
> score based on keywords, recency, and density; the chosen `safestRoute`
> has the lowest aggregated score.

```json
{
  "success": true,
  "safestRoute": {
    "distance": 5200,
    "duration": 900000,
    "geometry": {
      "coordinates": [
        [-74.0060, 40.7128],
        [-74.0050, 40.7140],
        [-74.0040, 40.7150],
        [-73.9855, 40.7580]
      ]
    },
    "safetyScore": 45.2,
    "riskLevel": "safe",
    "incidentStats": { "total": 3, "high": 1, "medium": 2, "low": 0 },
    "incidentList": [
      { "lat": 40.715, "lng": -74.005, "severity": "high", "description": "Armed robbery", "timestamp": "2026-02-25T10:00:00Z" },
      { "lat": 40.716, "lng": -74.004, "severity": "medium", "description": "Suspicious activity", "timestamp": "2026-02-24T08:00:00Z" }
    ],
    "explanation": "Route passes near 3 reported incidents (1 high severity, 2 medium severity). Safety score indicates a safe path."
  },
  "mediumRoute": {
    "distance": 4800,
    "duration": 800000,
    "geometry": { "coordinates": [...] },
    "safetyScore": 65.8,
    "riskLevel": "medium"
  },
  "dangerousRoute": {
    "distance": 4200,
    "duration": 700000,
    "geometry": { "coordinates": [...] },
    "safetyScore": 98.3,
    "riskLevel": "dangerous"
  },
  "incidents": [
    {
      "lat": 40.7150,
      "lng": -74.0050,
      "severity": "high",
      "description": "Armed robbery"
    }
  ]
}
```

**Validation:**
- startLat, startLng, endLat, endLng: Required float values

**What Happens:**
1. Fetches routes from Graphhopper API
2. Queries verified incidents in the area
3. Calculates safety score for each route
4. Weighs by crime density and severity
5. Returns routes ranked by safety
6. Includes incident markers on map

**Safety Scoring Algorithm:**
```
Safety Score = Distance + (Crime Density × Distance × 0.5)
- Lower score = safer route
- Uses Haversine formula for distances
- Weighs incidents by severity (low: 0.3, medium: 0.6, high: 1.0)
```

---

## 🔄 Real-time Events (Socket.io)

### Connect to Socket
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected to SafeRoute');
});
```

### Join a Zone
```javascript
socket.emit('join_zone', {
  lat: 40.7128,
  lng: -74.0060
});
```

### Listen for New Incidents
```javascript
socket.on('new_incident', (incident) => {
  console.log('New incident:', incident);
  // incident = {
  //   id: "507f1f77bcf86cd799439012",
  //   lat: 40.7128,
  //   lng: -74.0060,
  //   description: "Armed robbery",
  //   severity: "high",
  //   verified: true,
  //   confidence: 0.92,
  //   timestamp: "2024-02-11T10:30:00Z",
  //   reporter: "John Doe"
  // }
});
```

---

## ❌ Error Responses

### 400 Bad Request
**When:** Validation fails or missing required fields

```json
{
  "error": "Validation failed",
  "details": [
    {
      "msg": "Email must be a valid email",
      "param": "email"
    }
  ]
}
```

### 401 Unauthorized
**When:** No token provided or token invalid

```json
{
  "error": "No token provided"
}
```

Or:

```json
{
  "error": "Invalid token"
}
```

### 404 Not Found
**When:** Resource doesn't exist

```json
{
  "error": "Incident not found"
}
```

### 500 Internal Server Error
**When:** Server error

```json
{
  "error": "Failed to report incident"
}
```

---

## 🧪 Testing with cURL

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

### Report Incident
```bash
TOKEN="your_jwt_token_from_login"

curl -X POST http://localhost:5000/api/incidents/report \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "lat": 40.7128,
    "lng": -74.0060,
    "description": "Robbery at the intersection",
    "severity": "high"
  }'
```

### Get Incidents
```bash
curl "http://localhost:5000/api/incidents?lat=40.7128&lng=-74.0060&radius=5"
```

### Calculate Route
```bash
TOKEN="your_jwt_token_from_login"

curl -X POST http://localhost:5000/api/routes/calculate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "startLat": 40.7128,
    "startLng": -74.0060,
    "endLat": 40.7580,
    "endLng": -73.9855
  }'
```

---

## 📊 Data Types

### Coordinates
Format: 
- **Latitude:** -90 to 90
- **Longitude:** -180 to 180
Example: lat: 40.7128, lng: -74.0060

### Severity Levels
```
"low"     - Minor incident
"medium"  - Moderate incident
"high"    - Severe incident
```

### Distance
Returned in **meters** from APIs
- 1000 meters = 1 kilometer
- 5000 meters = 5 kilometers

### Duration
Returned in **milliseconds**
- 3600000 ms = 1 hour
- 60000 ms = 1 minute

### Confidence Score
Range: **0.0 to 1.0**
- 0.0 = Definitely spam
- 0.5 = Uncertain
- 1.0 = Definitely real crime

---

## 🔒 Authentication

### JWT Token Structure
```
Header = {
  "alg": "HS256",
  "typ": "JWT"
}

Payload = {
  "id": "507f1f77bcf86cd799439011",
  "iat": 1707575400,
  "exp": 1708180200
}

Signature = HMAC-SHA256(header.payload, JWT_SECRET)
```

### Token Lifespan
- **Expires in:** 7 days
- **Format:** `Bearer YOUR_TOKEN`
- **Header:** `Authorization: Bearer YOUR_TOKEN`

### Token Refresh
Tokens don't auto-refresh. Users must login again after expiration.

---

## 📈 Rate Limiting (Ready to Implement)

Current: No rate limiting (development)

For production, implement:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## 🔍 Debugging

### Enable Debug Logging
```javascript
// In server.js
io.set('debug', true);
```

### Check Connection
```bash
# Backend health check
curl http://localhost:5000/api/health
```

### MongoDB Connection
```bash
# Test with MongoDB Compass
# Connection string: mongodb+srv://user:password@cluster.mongodb.net/saferoute-ai
```

### View Logs
```bash
# Backend console should show:
# 🚀 SafeRoute AI Backend running on port 5000
# Socket connected: socket_id
```

---

## 🚀 Production Deployment

### Before Deploying
1. Update JWT_SECRET to strong random value
2. Set NODE_ENV=production
3. Enable rate limiting
4. Add HTTPS/SSL
5. Update CORS origin to production domain

### Environment Variables
Set on Render/Railway dashboard:
```
MONGODB_URI=production_uri
JWT_SECRET=strong_random_secret
HUGGINGFACE_API_KEY=your_key
GRAPHHOPPER_API_KEY=your_key
FRONTEND_URL=https://your-frontend-url.com
```

---

## 📚 Related Documentation

- See QUICKSTART.md for local setup
- See README.md for full deployment guide
- See IMPLEMENTATION.md for features overview
