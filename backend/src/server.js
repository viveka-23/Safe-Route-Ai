// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/database');

// Routes
const authRoutes = require('./routes/auth');
const incidentRoutes = require('./routes/incidents');
const routeRoutes = require('./routes/routes');

// Models
const Incident = require('./models/Incident');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: '*', // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: false,
  })
);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/routes', routeRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('✅ Health check called from:', req.ip);
  res.json({ status: 'OK', timestamp: new Date() });
});

// Simple test endpoint
app.post('/api/test', (req, res) => {
  console.log('✅ Test endpoint called from:', req.ip);
  res.json({ success: true, message: 'Backend is reachable!' });
});

// Socket.io connections
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // User joins a zone (lat/lng bounding box)
  socket.on('join_zone', (data) => {
    const room = `zone_${data.lat}_${data.lng}`;
    socket.join(room);
    console.log(`User ${socket.id} joined ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Middleware to attach io to requests for broadcasting
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Modify incident controller to broadcast new incidents
// Add this after incident is saved in incidentController.js
app.post('/api/incidents/report', async (req, res, next) => {
  // Original logic happens, then:
  // io.emit('new_incident', incident);
  // Users in zones will receive updates
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SafeRoute AI Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Listening on: http://0.0.0.0:${PORT}`);
});

module.exports = { app, io };
