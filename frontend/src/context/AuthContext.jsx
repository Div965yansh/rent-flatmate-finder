import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore authentication from stored JWT on initial mount
  useEffect(() => {
    let isMounted = true;

    async function restoreAuth() {
      const storedToken = localStorage.getItem('token');

      if (!storedToken || typeof storedToken !== 'string' || !storedToken.trim()) {
        if (isMounted) {
          setUser(null);
          setToken(null);
          setLoading(false);
        }
        return;
      }

      try {
        // Interceptor in api.js will automatically attach the Bearer token
        const response = await api.get('/auth/me');
        if (isMounted) {
          if (response.data && response.data.user) {
            setUser(response.data.user);
            setToken(storedToken);
          } else {
            throw new Error('Invalid user response');
          }
        }
      } catch (error) {
        // Invalid or expired token
        localStorage.removeItem('token');
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    restoreAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Login handler
  const login = useCallback(async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    const { user: userData, token: authToken } = response.data;

    localStorage.setItem('token', authToken);
    setToken(authToken);
    setUser(userData);

    return { user: userData, token: authToken };
  }, []);

  // Register handler
  const register = useCallback(async (registrationData) => {
    const response = await api.post('/auth/register', registrationData);
    const { user: userData, token: authToken } = response.data;

    localStorage.setItem('token', authToken);
    setToken(authToken);
    setUser(userData);

    return { user: userData, token: authToken };
  }, []);

  // Logout handler
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(user && token),
      login,
      register,
      logout,
    }),
    [user, token, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
