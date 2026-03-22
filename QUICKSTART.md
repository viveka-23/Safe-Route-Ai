# SafeRoute AI - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Prerequisites Check
```bash
node --version    # Should be 16+
npm --version     # Should be 8+
```

### Step 2: Get API Keys (10 minutes)

1. **MongoDB Atlas** (Database)
   - Visit: https://www.mongodb.com/cloud/atlas
   - Sign up (free)
   - Create cluster
   - Get connection string
   - Format: `mongodb+srv://user:password@cluster.mongodb.net/saferoute-ai`

2. **HuggingFace** (AI Verification)
   - Visit: https://huggingface.co
   - Sign up (free)
   - Go to Settings → Access Tokens
   - Copy token
   - Keep it safe!

3. **Graphhopper** (Routing)
   - Visit: https://graphhopper.com
   - Sign up (free tier)
   - Get API key from dashboard
   - (Optional - backend has fallback)

### Step 3: Setup Backend

```bash
cd backend

# Create environment file
cp .env.example .env

# Edit .env and add your keys:
# MONGODB_URI=mongodb+srv://...
# HUGGINGFACE_API_KEY=hf_...
# GRAPHHOPPER_API_KEY=...
# JWT_SECRET=your_secret_key_here

# Install dependencies
npm install

# Start server
npm run dev
```

**Expected output:**
```
🚀 SafeRoute AI Backend running on port 5000
Environment: development
```

### Step 4: Setup Frontend

**In a new terminal:**
```bash
cd frontend

# Create environment file
cp .env.example .env

# Install dependencies
npm install

# Start Expo
npm start
```

**What you'll see:**
```
› Metro waiting on exp://192.168.x.x:19000
› Scan the QR code above with Expo Go (Android) or Camera (iOS)
```

### Step 5: Test the App

1. **On Android:**
   - Install Expo Go from Play Store
   - Scan QR code from terminal

2. **On iOS:**
   - Open Camera app
   - Point at QR code
   - Opens in Expo Go

3. **Test features:**
   - ✓ Create account
   - ✓ Login (try test credentials)
   - ✓ Allow location access
   - ✓ See map with your location
   - ✓ Search a destination
   - ✓ Click "Find Safest Route"
   - ✓ Long-press map to report incident

---

## 🧪 Test Accounts

No accounts created yet - make one!

**Test credentials:**
```
Email: test@example.com
Password: Test123!
Name: Test User
```

---

## 🚨 Common Issues & Fixes

### Backend won't start
```bash
# Error: Port 5000 already in use
lsof -ti:5000 | xargs kill -9  # Mac/Linux
netstat -ano | findstr :5000    # Windows

# Then restart: npm run dev
```

### Can't connect to MongoDB
```
✗ Error: connection ECONNREFUSED
```

**Fix:**
- Check connection string in .env
- Add your IP to Atlas whitelist (or use 0.0.0.0)
- Verify username/password are URL encoded
- Try connecting from MongoDB Compass first

### Map not loading on app
```
✗ No map showing / permission denied
```

**Fix:**
- Grant location permission when prompted
- For emulators: set mock location in developer settings
- Restart app
- Check that backend is running

### Socket.io not broadcasting incidents
```
✓ Report submitted but other users don't see it
```

**Fix:**
- Verify backend Socket.io is running
- Check for firewall blocking WebSocket
- Look at browser console for errors
- Restart backend: `npm run dev`

### "Undefined is not an object" React error
```
✗ TypeError: Cannot read property 'x' of undefined
```

**Fix:**
- Check you're using functional components
- Verify all imports are correct
- Ensure tokens are being passed properly
- Check API responses in Network tab

---

## 📊 API Testing

### Test Backend with cURL

**1. Register:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOi...",
  "user": { "id": "...", "name": "John Doe", "email": "john@example.com" }
}
```

**2. Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

**3. Report Incident (use token from login):**
```bash
curl -X POST http://localhost:5000/api/incidents/report \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "lat": 40.7128,
    "lng": -74.0060,
    "description": "Robbery at the intersection",
    "severity": "high"
  }'
```

**4. Get Incidents:**
```bash
curl "http://localhost:5000/api/incidents?lat=40.7128&lng=-74.0060&radius=5"
```

---

## 📱 Device vs Emulator

### Android Emulator
```bash
# Run Android emulator first, then:
npm run android
```

### iOS Simulator (Mac only)
```bash
npm run ios
```

### Physical Phone
```bash
npm start
# Scan QR with Expo Go app
```

**For physical device to connect to localhost backend:**
- Get your machine's IP address
- Update frontend `.env`:
  ```
  EXPO_PUBLIC_API_URL=http://YOUR_IP:5000/api
  EXPO_PUBLIC_SOCKET_URL=http://YOUR_IP:5000
  ```
- Both device and computer must be on same network

---

## 🔧 Environment Variables Reference

**Backend `.env`:**
```
# Required
MONGODB_URI=mongodb+srv://user:pwd@cluster/database
JWT_SECRET=random_secret_key_at_least_32_chars
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxx

# Optional
PORT=5000
NODE_ENV=development
GRAPHHOPPER_API_KEY=your_key_optional
FRONTEND_URL=http://localhost:8081
```

**Frontend `.env`:**
```
EXPO_PUBLIC_API_URL=http://localhost:5000/api
EXPO_PUBLIC_SOCKET_URL=http://localhost:5000
EXPO_PUBLIC_NOMINATIM_API=https://nominatim.openstreetmap.org/search
```

---

## 📚 Project Structure

```
saferoute-ai/
├── backend/
│   ├── src/
│   │   ├── server.js           # Express + Socket.io setup
│   │   ├── models/             # MongoDB schemas
│   │   ├── controllers/        # API logic
│   │   ├── routes/             # API endpoints
│   │   ├── middleware/         # Auth, validation
│   │   ├── utils/              # AI verification, routing
│   │   └── config/             # Database connection
│   ├── package.json
│   └── .env                    # Configure with your keys
│
└── frontend/
    ├── App.js                   # Root component
    ├── app/
    │   ├── screens/             # Map, Auth, Incidents
    │   ├── navigation/          # React Navigation
    │   ├── components/          # Reusable UI components
    │   ├── context/             # Auth context
    │   ├── services/            # API client, Socket.io
    │   └── utils/               # Helper functions
    ├── package.json
    ├── app.json                 # Expo config
    └── .env                     # API URLs
```

---

## 🚀 Next Steps

1. **Customize:**
   - Change app colors in styles
   - Modify map center coordinates
   - Add your app icon

2. **Enhance:**
   - Add more incident categories
   - Implement user profiles
   - Add incident photos

3. **Deploy:**
   - See README.md for Render/Railway deployment
   - Build APK/IPA for app stores

4. **Secure:**
   - Rotate JWT_SECRET in production
   - Enable rate limiting
   - Add HTTPS/SSL

---

## 💡 Tips

- Use Postman or Insomnia for API testing
- Check MongoDB Compass to view database data
- Use Redux/Zustand if state becomes complex
- Add error boundaries for production
- Test on real device before deploying

---

## 📖 Full Documentation

See `README.md` in root for:
- ✓ Complete deployment guide
- ✓ Database schema details
- ✓ API documentation
- ✓ Troubleshooting guide
- ✓ Testing procedures

---

**Happy building! 🎉**

Questions? Check console logs for error details or rebuild from scratch if stuck.
