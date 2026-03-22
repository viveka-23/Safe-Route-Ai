import React, { createContext, useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

console.log('AuthContext - API_URL:', API_URL);
console.log('Using full URL construction for axios requests');

// Create axios instance without baseURL - use full URLs directly
const axiosInstance = axios.create({
  timeout: 15000, // 15 second timeout
});

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if user is already logged in on app start
  const bootstrapAsync = useCallback(async () => {
    try {
      // In React Native, you'd use AsyncStorage
      // For now, we'll skip token restoration and require login
      // Implement AsyncStorage for production:
      // const savedToken = await AsyncStorage.getItem('authToken');
    } catch (e) {
      console.error('Failed to restore token', e);
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
    setLoading(true);
    setError(null);
    try {
      const fullUrl = `${API_URL}/auth/register`;
      console.log('Registering user:', { name, email });
      console.log('Using URL:', fullUrl);
      const response = await axiosInstance.post(fullUrl, {
        name,
        email,
        password,
      });

      console.log('Registration response:', response.data);
      const { token: newToken, user: userData } = response.data;
      // AsyncStorage.setItem('authToken', newToken);
      setToken(newToken);
      setUser(userData);
      return { success: true };
    } catch (err) {
      console.error('Registration error:', err.message);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        url: err.config?.url,
        code: err.code,
        errno: err.errno,
      });
      const errorMsg = err.response?.data?.error || err.message || 'Registration failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const fullUrl = `${API_URL}/auth/login`;
      console.log('Logging in user:', email);
      console.log('Using URL:', fullUrl);
      const response = await axiosInstance.post(fullUrl, {
        email,
        password,
      });

      console.log('Login response:', response.data);
      const { token: newToken, user: userData } = response.data;
      // AsyncStorage.setItem('authToken', newToken);
      setToken(newToken);
      setUser(userData);
      return { success: true };
    } catch (err) {
      console.error('Login error:', err.message);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        url: err.config?.url,
        code: err.code,
        errno: err.errno,
      });
      const errorMsg = err.response?.data?.error || err.message || 'Login failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      // AsyncStorage.removeItem('authToken');
      setToken(null);
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = {
    user,
    token,
    loading,
    error,
    bootstrapAsync,
    register,
    login,
    logout,
    isSignedIn: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
