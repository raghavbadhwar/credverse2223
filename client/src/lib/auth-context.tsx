'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'institution' | 'student' | 'verifier' | 'admin';
  walletAddress?: string;
  did?: string;
  isVerified: boolean;
  institutionName?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  connectWallet: (walletData: WalletConnectData) => Promise<void>;
  logout: () => void;
  token: string | null;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: 'institution' | 'student' | 'verifier';
  institutionName?: string;
  walletAddress?: string;
}

interface WalletConnectData {
  walletAddress: string;
  signature: string;
  message: string;
  email?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('credverse_token');
    if (savedToken) {
      setToken(savedToken);
      // Verify token and get user data
      verifyToken(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  // Set token in API headers when token changes
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('credverse_token', token);
    } else {
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('credverse_token');
    }
  }, [token]);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      // Set token in headers for this request
      const response = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${tokenToVerify}` },
      });
      
      setUser(response.data.data);
      setToken(tokenToVerify);
    } catch (error) {
      console.error('Token verification failed:', error);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user: userData, token: userToken } = response.data.data;
      
      setUser(userData);
      setToken(userToken);
    } catch (error: any) {
      const message = error.response?.data?.error || 'Login failed';
      throw new Error(message);
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await api.post('/auth/register', data);
      const { user: userData, token: userToken } = response.data.data;
      
      setUser(userData);
      setToken(userToken);
    } catch (error: any) {
      const message = error.response?.data?.error || 'Registration failed';
      throw new Error(message);
    }
  };

  const connectWallet = async (walletData: WalletConnectData) => {
    try {
      const response = await api.post('/auth/wallet-connect', walletData);
      const { user: userData, token: userToken, isNewUser } = response.data.data;
      
      if (!isNewUser && userData && userToken) {
        setUser(userData);
        setToken(userToken);
      }
      
      return response.data.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Wallet connection failed';
      throw new Error(message);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    connectWallet,
    logout,
    token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}