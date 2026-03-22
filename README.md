# SafeRoute AI - Complete Setup & Deployment Guide

## 🚀 Project Overview

SafeRoute AI is a React Native mobile app that combines Google Maps-style navigation with real-time crime incident data and AI verification. The app helps users navigate safely by:

- Showing crime incidents on the map
- Calculating routes based on safety scores
- AI-verifying incident reports (using HuggingFace sentiment model)
  - A fallback model list is now used when the default model is retired; set `HUGGINGFACE_MODEL` in `.env` to choose a different one

### Rule-based severity scoring engine

In addition to AI verification, the backend now includes a deterministic
crime severity scoring engine (see `src/utils/riskModel.js`).  It:

1. Maps text keywords (murder, robbery, theft, etc.) to numeric weights.
2. Counts multiple occurrences and applies a frequency multiplier.
3. Applies a time-decay factor so recent incidents have more impact.
4. Filters incidents by proximity to a route (1 km radius) and sums scores.
5. Normalizes the total by route length (crime density per km) and returns
   a single `riskScore` used during route calculation.

This engine is always available, works offline, and is fully explainable –
no external API calls are required once incidents are in the database.

- Real-time incident updates via Socket.io

## 📋 Tech Stack

**Frontend:** React Native, Expo, Mapbox/Google Maps, Socket.io client
**Backend:** Node.js, Express, MongoDB, Socket.io server
**AI:** HuggingFace API for incident classification
**Deployment:** Render/Railway (Backend), Expo (Frontend)

---

## 🔧 Local Development Setup

### Prerequisites
- Node.js 16+ and npm
- Expo CLI: `npm install -g expo-cli`
- MongoDB Atlas account (free tier available)
- Graphhopper or Mapbox API key
- HuggingFace API key

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```

4. **Update `.env` with your credentials:**
   ```
   MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/saferoute-ai
   JWT_SECRET=your_super_secret_jwt_key_12345
   PORT=5000
   NODE_ENV=development
   GRAPHHOPPER_API_KEY=your_key
   HUGGINGFACE_API_KEY=your_key
   FRONTEND_URL=http://localhost:8081
   ```

5. **Start the server:**
   ```bash
   npm run dev
   ```
   Backend runs on `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```

4. **Update `.env`:**
   ```
   EXPO_PUBLIC_API_URL=http://localhost:5000/api
   EXPO_PUBLIC_SOCKET_URL=http://localhost:5000
   EXPO_PUBLIC_NOMINATIM_API=https://nominatim.openstreetmap.org/search
   ```

5. **Start Expo:**
   ```bash
   npm start
   ```
   
   Then press:
   - `a` for Android
   - `i` for iOS
   - `w` for web (development only)

---

## 🗄️ Database Setup (MongoDB)

1. **Create MongoDB Atlas cluster:**
   - Go to https://www.mongodb.com/cloud/atlas
   - Create free account
   - Create new cluster
   - Add IP to whitelist (or allow from anywhere: 0.0.0.0)
   - Create database user
   - Copy connection string

2. **Update Backend `.env`:**
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/saferoute-ai
   ```

3. **Geospatial indexing (automatic):**
   The backend models include geospatial indexes for location queries. MongoDB creates them automatically when data is inserted with lat/lng coordinates.

---

## 🔐 Authentication Setup

### JWT Configuration

1. Generate a secure JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Add to backend `.env`:
   ```
   JWT_SECRET=your_generated_secret_here
   ```

### Password Hashing

Uses bcryptjs with 10 salt rounds. Passwords are automatically hashed before saving to MongoDB.

---

## 📡 API Endpoints

### Authentication

```bash
POST /api/auth/register
Body: { name, email, password }

POST /api/auth/login
Body: { email, password }
```

### Incidents

```bash
GET /api/incidents?lat=40.7128&lng=-74.0060&radius=5
Returns verified incidents within radius (km)

POST /api/incidents/report
Headers: Authorization: Bearer {token}
Body: { lat, lng, description, severity }

GET /api/incidents/my-incidents
Headers: Authorization: Bearer {token}

PATCH /api/incidents/:id/verify
Headers: Authorization: Bearer {token}
Body: { verified: true|false }
# Allows a user to manually mark their own report verified/unverified
```

Users reporting incidents can choose a severity (low/medium/high); this is included
on cards and used during routing. Reports are automatically checked via the
AI model, but you may override using the PATCH endpoint if the classification
is incorrect.

### Routes

```bash
POST /api/routes/calculate
Headers: Authorization: Bearer {token}
Body: { startLat, startLng, endLat, endLng }
Returns: { safestRoute, mediumRoute, dangerousRoute, incidents }

Each route object now includes:
- `safetyScore` (numeric, lower is safer)
- `riskLevel` ("safe" | "medium" | "dangerous")
- `incidentStats` (counts by severity)
- `explanation` (human-readable description of why the route was classified)

```

---

## 🤖 AI Verification Setup

### HuggingFace API

1. **Create account:** https://huggingface.co
2. **Generate API token:** Settings → Access Tokens → Create new token
3. **Add to backend `.env`:**
   ```
   HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxx
   ```

### How it works:
- Text is sent to HuggingFace's sentiment analysis model
- Negative sentiment indicates real crime report
- Returns confidence score (0-1)
- Stores verification status in MongoDB

---

## 🗺️ Routing API Setup

### Using Graphhopper (Free tier available)

1. **Create account:** https://graphhopper.com
2. **Get API key:** Dashboard → API Access
3. **Add to backend `.env`:**
   ```
   GRAPHHOPPER_API_KEY=your_key
   ```

### Using Mapbox (Alternative)

1. Create account: https://www.mapbox.com
2. Get access token from dashboard
3. Add to `.env`: `MAPBOX_API_KEY=pk_...`
4. Update `routeController.js` to use Mapbox API instead

---

## 🚀 Deployment

### Backend Deployment (Render)

1. **Create Render account:** https://render.com
2. **Create New Web Service**
3. **Connect GitHub repository:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo>
   git push -u origin main
   ```

4. **Configure in Render:**
   - Build command: `npm install`
   - Start command: `npm start`
   - Region: Choose closest to users

5. **Add Environment Variables in Render:**
   Copy all values from backend `.env` (except PORT)

6. **Deploy:**
   Render automatically deploys on git push

7. **Get deployed URL:** `https://saferoute-api.onrender.com`

### Backend Deployment (Railway Alternative)

1. **Create Railway account:** https://railway.app
2. **Connect GitHub**
3. **Add MongoDB service** (if not using Atlas)
4. **Configure environment variables**
5. **Deploy**

### Frontend Deployment (Expo)

1. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   #or use expo CLI built-in EAS
   ```

2. **Login to Expo:**
   ```bash
   expo login
   ```

3. **Build APK (Android):**
   ```bash
   eas build -p android --profile preview
   ```
   
   Wait for build to complete, then download APK

4. **Build IPA (iOS - requires Apple account):**
   ```bash
   eas build -p ios --profile preview
   ```

5. **Update Frontend `.env` with deployed backend:**
   ```
   EXPO_PUBLIC_API_URL=https://saferoute-api.onrender.com/api
   EXPO_PUBLIC_SOCKET_URL=https://saferoute-ai.onrender.com
   ```

6. **Rebuild after env changes:**
   ```bash
   eas build --platform android
   ```

---

## 🐛 Troubleshooting

### Backend Issues

**Port already in use:**
```bash
# Kill process using port 5000
lsof -ti:5000 | xargs kill -9  # Mac/Linux
netstat -ano | findstr :5000  # Windows
```

**MongoDB connection failed:**
- Check IP whitelist in MongoDB Atlas
- Verify connection string format
- Ensure username/password are URL encoded

**Socket.io not connecting:**
- Verify FRONTEND_URL matches actual frontend URL
- Check CORS configuration in server.js
- Enable debug: `io.set('debug', true);`

**HuggingFace API errors:**
- Verify API key is correct
- Check rate limits (free tier limited)
- Use fallback incident verification if API fails

### Frontend Issues

**Map not showing:**
- Request location permission on device
- Verify backend API is running
- Check Android/iOS specific location requirements

**Socket.io not receiving updates:**
- Check WebSocket support on network (some WiFi blocks it)
- Verify backend Socket.io is broadcasting correctly
- Check browser console for connection errors

**Incidents not appearing:**
- Verify incidents are verified (verified: true)
- Check geospatial index is created
- Use MongoDB Compass to verify data

**Build failures on Render:**
```bash
# View logs in Render dashboard
# Increase build timeout if needed
```

---

## 📊 Database Models

### User
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  createdAt: Date
}
```

### Incident
```javascript
{
  userId: ObjectId (ref: User),
  lat: Number,
  lng: Number,
  description: String,
  severity: 'low' | 'medium' | 'high',
  verified: Boolean,
  confidence: Number (0-1),
  timestamp: Date,
  reports: Number
}
```

---

## 🔄 Real-time Updates Flow

```
User Reports Incident
        ↓
Backend validates & calls HuggingFace API
        ↓
Incident saved to MongoDB with verified flag
        ↓
Socket.io broadcasts to all connected users
        ↓
Frontend receives new_incident event
        ↓
Map updates with new marker
        ↓
Users see crime incident in real-time
```

---

## 👥 Testing Incident Reporting

1. **From any location on map:**
   - Tap "Report Incident" button
   - Or long-press map at specific location

2. **Fill form:**
   - Description: "Robbery near the street corner" (avoid spam words)
   - Severity: Select level
   - Location: Auto-filled from map

3. **Submit:**
   - Backend sends to HuggingFace
   - Shows confidence score
   - Saves verified/unverified

4. **Real-time broadcast:**
   - Other users see incident within seconds
   - Marker appears on their map

---

## 📱 Testing on Physical Device

### Android:
1. Install Expo Go app
2. Run `npm start` in frontend
3. Scan QR code with phone
4. App loads in Expo Go

### iOS:
1. Install Expo Go from App Store
2. Run `npm start` in frontend
3. Scan QR code with Camera app
4. Opens in Expo Go

### Tips:
- Use mobile hotspot on laptop for local development
- Ensure device and laptop are on same network
- Test with real GPS location (use GPS simulator on emulator)

---

## 🔗 Environment Variables Summary

**Backend (.env):**
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
PORT=5000
NODE_ENV=development
GRAPHHOPPER_API_KEY=...
HUGGINGFACE_API_KEY=...
FRONTEND_URL=http://localhost:8081
```

**Frontend (.env):**
```
EXPO_PUBLIC_API_URL=http://localhost:5000/api
EXPO_PUBLIC_SOCKET_URL=http://localhost:5000
EXPO_PUBLIC_NOMINATIM_API=https://nominatim.openstreetmap.org/search
```

---

## 📚 Useful Links

- [React Native Docs](https://reactnative.dev)
- [Expo Documentation](https://docs.expo.dev)
- [mongoose ODM](https://mongoosejs.com)
- [Socket.io Guide](https://socket.io/docs)
- [HuggingFace API](https://huggingface.co/inference-api)
- [Graphhopper API](https://graphhopper.com/api/1/docs)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

---

## 📝 License

MIT License - Feel free to use for learning and development

---

## 🆘 Support

Common commands:

```bash
# Start everything locally
# Terminal 1 (Backend)
cd backend && npm run dev

# Terminal 2 (Frontend)
cd frontend && npm start

# View MongoDB data
# Use MongoDB Compass or Atlas Web Interface

# Generate API keys quickly
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

**Happy coding! SafeRoute AI makes navigation safer for everyone. 🚀**
