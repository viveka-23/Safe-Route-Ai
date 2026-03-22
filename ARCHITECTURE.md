# SafeRoute AI - Architecture Overview

Visual guide to SafeRoute AI system architecture and data flow.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SafeRoute AI Architecture                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐              ┌──────────────────────┐
│   React Native App   │              │   Backend Server     │
│      (Expo)          │              │  (Node + Express)    │
├──────────────────────┤              ├──────────────────────┤
│ MapScreen.js         │──HTTP────────│ /api/routes/calc     │
│ AuthScreen.js        │  HTTPS       │ /api/incidents       │
│ MyIncidentsScreen.js │              │ /api/auth/*          │
│                      │              │                      │
│ Components:          │              │ Socket.io Server     │
│ - PlaceSearchBar     │──WebSocket───│ (Real-time updates)  │
│ - IncidentReportMdl  │              │                      │
│                      │              │ Controllers:         │
│ Services:            │              │ - authController     │
│ - api.js (axios)     │              │ - incidentController │
│ - socket.js (io)     │              │ - routeController    │
│                      │              │                      │
│ Context:             │              │ Models:              │
│ - AuthContext        │              │ - User               │
│                      │              │ - Incident           │
│ Navigation:          │              │                      │
│ - Tab + Stack        │              │ Utils:               │
│                      │              │ - dijkstra.js        │
│                      │              │ - ai-verification.js │
└──────────────────────┘              └──────────────────────┘
         │                                      │
         │                                      │
         └──────────────┬───────────────────────┘
                        │
                        │
         ┌──────────────┴───────────────────┐
         │                                  │
         ▼                                  ▼
┌─────────────────────┐          ┌──────────────────────┐
│  MongoDB Database   │          │  External APIs       │
├─────────────────────┤          ├──────────────────────┤
│ Collections:        │          │ HuggingFace API      │
│ - users             │          │ (AI Verification)    │
│ - incidents         │          │                      │
│                     │          │ Graphhopper/Mapbox   │
│ Geospatial Index    │          │ (Route Calculation)  │
│ on lat/lng          │          │                      │
│                     │          │ Nominatim API        │
│ Real-time queries   │          │ (Place Search)       │
└─────────────────────┘          └──────────────────────┘
```

---

## 📊 Data Flow Diagram

### User Authentication Flow
```
┌──────────────┐
│ User Input   │
│ (Email/Pwd)  │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ AuthScreen Component │
│ (Frontend)           │
└──────┬───────────────┘
       │
       ▼ POST /api/auth/login
┌──────────────────────┐
│ authController       │
│ - Input validation   │
│ - Find user in DB    │
│ - Compare password   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ User Model           │
│ - matchPassword()    │
│ - bcrypt verify      │
└──────┬───────────────┘
       │
       ▼ Generate JWT
┌──────────────────────┐
│ JWT Token created    │
│ (7 day expiry)       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Frontend receives    │
│ - token              │
│ - user data          │
│ - Sets AuthContext   │
│ - Navigate to Map    │
└──────────────────────┘
```

### Incident Reporting Flow
```
┌──────────────────────┐
│ User long-press map  │
│ (or Report button)   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ IncidentReportModal  │
│ - Shows location     │
│ - Input description  │
| - Select severity    │
└──────┬───────────────┘
       │
       ▼ POST /api/incidents/report
┌──────────────────────┐
│ incidentController   │
│ - Validate input     │
│ - Get user ID        │
│ - Extract lat/lng    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ AI Verification      │
│ (HuggingFace API)    │
│ - Analyze text       │
│ - Sentiment score    │
│ - Return confidence  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Incident Model       │
│ - Save to MongoDB    │
│ - verified: T/F      │
│ - confidence score   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Socket.io broadcast  │
│ new_incident event   │
│ sent to all clients  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Other users receive  │
│ incident in real-time│
│ - Marker appears     │
│ - Shows severity     │
└──────────────────────┘
```

### Route Calculation Flow
```
┌──────────────────────┐
│ User clicks          │
│ "Find Safest Route"  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ MapScreen            │
│ - Get start coords   │
│ - Get end coords     │
│ - Call API           │
└──────┬───────────────┘
       │
       ▼ POST /api/routes/calculate
┌──────────────────────┐
│ routeController      │
│ - Validate inputs    │
│ - Extract bounds     │
└──────┬───────────────┘
       │
       ├─────────────────────────────────┐
       │                                 │
       ▼                                 ▼
┌──────────────────┐          ┌─────────────────────┐
│ Fetch Routes     │          │ Query Incidents     │
│ Graphhopper API  │          │ (MongoDB geospatial)│
│ - Multiple routes│          │ - Within bounds     │
│ - Distance/time  │          │ - Only verified     │
└──────┬───────────┘          └─────────┬───────────┘
       │                               │
       └───────────────┬───────────────┘
                       │
                       ▼
               ┌──────────────────────┐
               │ Dijkstra Algorithm   │
               │ scoreRoutes()        │
               │ - Crime density      │
               │ - Incident proximity │
               │ - Severity weighting │
               │ Returns:             │
               │ - safest route       │
               │ - balanced route     │
               │ - fastest route      │
               └──────┬───────────────┘
                      │
                      ▼
               ┌──────────────────────┐
               │ Send to Frontend     │
               │ - 3 routes with      │
               │   colors (green/     │
               │   orange/red)        │
               │ - Incident markers   │
               │ - Draw polylines     │
               └──────────────────────┘
```

---

## 🗄️ Database Schema Relationships

```
┌─────────────────────────┐
│        Users            │
├─────────────────────────┤
│ _id (PK)               │
│ name: String           │
│ email: String (unique) │
│ password: String       │
│ createdAt: Date        │
└────────┬────────────────┘
         │
         │ 1:Many
         │ (user reports incidents)
         │
         ▼
┌─────────────────────────┐
│      Incidents          │
├─────────────────────────┤
│ _id (PK)               │
│ userId (FK) ──────────→│ Users._id
│ lat: Number            │
│ lng: Number            │
│ description: String    │
│ severity: Enum         │
│ verified: Boolean      │
│ confidence: 0-1        │
│ timestamp: Date        │
│ reports: Number        │
│                        │
│ Indexes:               │
│ - userId               │
│ - geospatial on lat/lng│
│ - timestamp (desc)     │
└─────────────────────────┘
```

---

## 🔄 API Request/Response Cycle

```
Frontend                           Backend
┌──────────────────┐              ┌──────────────────┐
│ MapScreen.js     │              │ server.js        │
│ calls apiClient. │              │ Express setup    │
│ calculateRoute() │              │                  │
└────────┬─────────┘              └──────────────────┘
         │
         │ POST /api/routes/calculate
         │ Headers: {
         │   "Authorization": "Bearer JWT",
         │   "Content-Type": "application/json"
         │ }
         │ Body: {
         │   startLat, startLng,
         │   endLat, endLng
         │ }
         │
         ├────────────────────────→│ Express Router
         │                          ├────────────→ routeController.js
         │                          │      │
         │                          │      ├─→ Graphhopper API
         │                          │      │   (Get routes)
         │                          │      │
         │                          │      ├─→ MongoDB Query
         │                          │      │   (Get incidents)
         │                          │      │
         │                          │      ├─→ Dijkstra Algorithm
         │                          │      │   (Score routes)
         │                          │      │
         │                          ├──────┘
         │                          │
         │ ← Accept: 200 OK        │
         │ {                       │
         │   safestRoute: {...},   │
         │   mediumRoute: {...},   │
         │   dangerousRoute: {...},│
         │   incidents: [...]      │
         │ }                       │
         │←──────────────────────  │
         │
         ▼
    Frontend receives
    - Updates MapScreen state
    - Draws polylines
    - Shows markers
    - Enables route selection
```

---

## 🔐 Authentication Token Flow

```
┌──────────────────────────────────────────────────────┐
│            JWT Token Lifecycle                        │
└──────────────────────────────────────────────────────┘

1. LOGIN/REGISTER
   ↓
   User sends credentials
   ↓
   Backend validates & checks DB
   ↓
   JWT Created: jwt.sign({ id }, SECRET, { expiresIn: '7d' })
   ↓
   Sent to Frontend

2. STORAGE
   ↓
   Frontend stores token (Context state)
   ↓
   Token kept in memory (not persisted in demo)
   ↓
   (Production: Save to AsyncStorage)

3. USAGE
   ↓
   Frontend includes in requests:
   Authorization: Bearer <token>
   ↓
   Backend auth.js middleware verifies
   ↓
   jwt.verify(token, SECRET)
   ↓
   Extracts user ID: req.userId = decoded.id
   ↓
   Controller accesses req.userId
   ↓
   Logs can be restricted by user

4. EXPIRATION
   ↓
   After 7 days token expires
   ↓
   jwt.verify() fails
   ↓
   Backend returns 401 Unauthorized
   ↓
   Frontend logs out user
   ↓
   User must login again
```

---

## 📡 Socket.io Real-time Events

```
┌────────────────────────────────────────────────┐
│     Socket.io Connection & Event Flow           │
└────────────────────────────────────────────────┘

Frontend                          Backend
┌──────────────┐                ┌──────────────┐
│ socket.io    │                │ Socket.io    │
│ client       │                │ server       │
└──────┬───────┘                └──────┬───────┘
       │
       │ io.connect()
       ├───────────────────────────→│
       │                            │ 'connect' event
       │ ←───────────────────────────┤
       │    (connection established) │
       │
       │ socket.emit('join_zone')
       ├───────────────────────────→│
       │    { lat, lng }            │
       │                            │ Server processes
       │                            │ Adds to room
       │
       ├─ Listening: 'new_incident'─├
       │                            │
       │    (Waiting for events)    │
       │
       │                            │ Another user reports incident
       │                            │
       │                            │ POST /api/incidents/report
       │                            │
       │                            │ io.emit('new_incident', {...})
       │
       │ ←──────────────────────────┤
       │    New incident received   │
       │    Update state            │
       │    Redraw map              │
       │
       │ socket.on('disconnect')
       │ (Network lost or logout)   │ Backend detects disconnect
       │                            │ Removes from rooms
       │                            │ Cleanup

```

---

## 🎯 Component Hierarchy

```
App.js
│
├─ AuthProvider (Context)
│  │
│  └─ RootNavigator
│     │
│     ├─ AuthScreen (user not signed in)
│     │  │
│     │  ├─ TextInputs (email, password, name)
│     │  ├─ Buttons (Login/Signup)
│     │  └─ Features display
│     │
│     └─ HomeTabs (user signed in)
│        │
│        ├─ MapStack
│        │  │
│        │  └─ MapScreen
│        │     ├─ MapView
│        │     ├─ PlaceSearchBar
│        │     ├─ IncidentReportModal
│        │     ├─ Route option buttons
│        │     └─ Action buttons
│        │
│        └─ MyIncidentsStack
│           │
│           └─ MyIncidentsScreen
│              ├─ FlatList
│              └─ IncidentCards
```

---

## 🔌 Module Dependencies

```
Backend Dependencies:
─────────────────────
server.js
├─ Express app
├─ Socket.io server
├─ CORS middleware
├─ Auth routes (→ authController)
├─ Incident routes (→ incidentController)
└─ Route routes (→ routeController)

authController
├─ User model
├─ jwt (generate tokens)
└─ express-validator

incidentController
├─ Incident model
├─ User model
├─ verifyIncidentReport (ai-verification.js)
└─ req.io (Socket.io)

routeController
├─ Incident model
├─ SafeRoute class (dijkstra.js)
└─ axios (Graphhopper API)

Frontend Dependencies:
──────────────────────
App.js
├─ AuthProvider
└─ RootNavigator

RootNavigator
├─ AuthScreen
├─ MapStack
│  └─ MapScreen
├─ MyIncidentsStack
│  └─ MyIncidentsScreen
└─ Navigation libraries

MapScreen
├─ useAuth (AuthContext)
├─ APIClient (api.js)
├─ Socket.io (socket.js)
├─ React Native Maps
├─ PlaceSearchBar
└─ IncidentReportModal

Services
├─ api.js (axios client)
└─ socket.js (io client)
```

---

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│          Production Deployment                   │
└─────────────────────────────────────────────────┘

┌─────────────────┐
│  App Stores     │
│ - Google Play   │
│ - Apple App     │
└────────┬────────┘
         │
         ▼
    ┌─────────────────────┐
    │   Expo Cloud        │
    │ (Build & hosting)   │
    └────────┬────────────┘
             │
             ▼
    ┌─────────────────────────────────┐
    │  SafeRoute Mobile App           │
    │  (React Native APK/IPA)         │
    │  Running on user devices        │
    └──────────────┬────────────────────┐
                   │                    │
      ┌────────────┘                    │
      │                                 │
      ▼                                 ▼
┌────────────────┐              ┌──────────────────┐
│ Render/Railway │              │ MongoDB Atlas    │
│ (Backend API)  │              │ (Database)       │
│ Node.js server │              │ Cloud hosted DB  │
│ Port: 443      │              │ Replicated data  │
└────────┬───────┘              └────────┬─────────┘
         │                              │
         └──────────────┬───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
    HuggingFace    Graphhopper      Nominatim
    (AI API)       (Routes)         (Place Search)
```

---

## 📈 Performance Considerations

```
Frontend Performance:
├─ Map rendering
│  ├─ Use FlatList for markers (virtualization)
│  ├─ Debounce search queries
│  └─ Cache place results
├─ Network requests
│  ├─ Batch API calls where possible
│  └─ Implement caching
└─ Memory
   ├─ Clean up Socket listeners
   └─ Avoid storing large objects

Backend Performance:
├─ Database queries
│  ├─ Geospatial indexing on incidents
│  ├─ Pagination (limit 100)
│  └─ Project only needed fields
├─ API response times
│  ├─ Cache route results
│  └─ Implement rate limiting
└─ Socket.io events
   ├─ Use rooms/namespaces
   ├─ Don't broadcast to all if unnecessary
   └─ Compress payloads
```

---

**This architecture provides a scalable, secure foundation for SafeRoute AI!**
