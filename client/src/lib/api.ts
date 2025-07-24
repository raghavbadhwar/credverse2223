import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching
    config.params = {
      ...config.params,
      _t: Date.now(),
    };
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('credverse_token');
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

// API Helper functions
export const apiHelpers = {
  // Auth endpoints
  auth: {
    login: (email: string, password: string) =>
      api.post('/auth/login', { email, password }),
    register: (data: any) => api.post('/auth/register', data),
    walletConnect: (data: any) => api.post('/auth/wallet-connect', data),
    refreshToken: (token: string) => api.post('/auth/refresh-token', { token }),
    forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  },

  // Credentials endpoints
  credentials: {
    issue: (data: any) => api.post('/credentials/issue', data),
    getIssued: (params?: any) => api.get('/credentials/issued', { params }),
    getReceived: (walletAddress: string, params?: any) =>
      api.get(`/credentials/received/${walletAddress}`, { params }),
    getById: (id: string) => api.get(`/credentials/${id}`),
    revoke: (id: string, reason: string) =>
      api.post(`/credentials/${id}/revoke`, { reason }),
    batchIssue: (students: any[]) =>
      api.post('/credentials/batch-issue', { students }),
  },

  // Verification endpoints
  verification: {
    verifyById: (id: string, includeMetadata?: boolean) =>
      api.get(`/verify/${id}`, { params: { includeMetadata } }),
    verifyCredential: (verifiableCredential: any) =>
      api.post('/verify/credential', { verifiableCredential }),
    verifyPresentation: (verifiablePresentation: any) =>
      api.post('/verify/presentation', { verifiablePresentation }),
    verifyQR: (qrData: any) => api.post('/verify/qr', { qrData }),
    getStats: (institutionAddress: string, timeframe?: string) =>
      api.get(`/verify/batch/${institutionAddress}`, { params: { timeframe } }),
    getStatus: () => api.get('/verify/status'),
  },

  // Institution endpoints
  institutions: {
    getProfile: () => api.get('/institutions/profile'),
    updateProfile: (data: any) => api.put('/institutions/profile', data),
    getStats: () => api.get('/institutions/stats'),
    getVerifyRequests: () => api.get('/institutions/verify-requests'),
    verifyInstitution: (id: string, verified: boolean, reason?: string) =>
      api.post(`/institutions/${id}/verify`, { verified, reason }),
    getPublicInfo: (id: string) => api.get(`/institutions/public/${id}`),
  },

  // IPFS endpoints
  ipfs: {
    upload: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post('/ipfs/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    uploadMetadata: (metadata: any) =>
      api.post('/ipfs/metadata', { metadata }),
    get: (cid: string) => api.get(`/ipfs/${cid}`),
    pin: (cid: string) => api.post(`/ipfs/pin/${cid}`),
    unpin: (cid: string) => api.delete(`/ipfs/pin/${cid}`),
    getStatus: () => api.get('/ipfs/status'),
  },
};

export default api;