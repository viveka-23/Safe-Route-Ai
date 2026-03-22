// src/controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

/**
 * Generate JWT token
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

/**
 * Register user
 * POST /api/register
 */
const register = async (req, res) => {
  try {
    console.log('📝 Register endpoint called with:', { name: req.body.name, email: req.body.email });
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      console.log('❌ User already exists:', email);
      return res.status(400).json({ error: 'User already exists' });
    }
    console.log('✅ User not found, creating new user...');

    // Create new user
    user = new User({
      name,
      email,
      password,
    });

    await user.save();
    console.log('✅ User saved successfully:', { id: user._id, name: user.name, email: user.email });

    // Generate token
    const token = generateToken(user._id);
    console.log('✅ Token generated');

    const responseData = {
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    };
    console.log('📤 Sending response:', { success: true, userId: user._id });
    res.status(201).json(responseData);
  } catch (error) {
    console.error('❌ Register error:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
};

/**
 * Login user
 * POST /api/login
 */
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

module.exports = { register, login, generateToken };
