import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getSession } from '@auth0/nextjs-auth0';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        try {
          const session = await getSession();
          if (session?.accessToken) {
            config.headers.Authorization = `Bearer ${session.accessToken}`;
          }
        } catch {
          // No session available
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired, redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/api/auth/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  get instance(): AxiosInstance {
    return this.client;
  }

  // Convenience methods
  async get<T>(url: string, params?: object) {
    return this.client.get<T>(url, { params });
  }

  async post<T>(url: string, data?: object) {
    return this.client.post<T>(url, data);
  }

  async put<T>(url: string, data?: object) {
    return this.client.put<T>(url, data);
  }

  async patch<T>(url: string, data?: object) {
    return this.client.patch<T>(url, data);
  }

  async delete<T>(url: string) {
    return this.client.delete<T>(url);
  }
}

export const api = new ApiClient().instance;

// Typed API functions
export const apiEndpoints = {
  // Auth
  login: () => api.post('/auth/login'),
  
  // Dashboard
  overview: (source?: string) => api.get('/overview', { params: { source } }),
  network: () => api.get('/network'),
  india: () => api.get('/india'),
  tables: () => api.get('/tables'),
  
  // Scanner
  checkIp: (ip: string) => api.get('/check-ip', { params: { ip } }),
  scan: (ip: string) => api.get('/scan', { params: { ip } }),
  
  // Clients & Scans
  listClients: () => api.get('/clients'),
  createClient: (data: { name: string; description?: string }) => api.post('/clients', data),
  deleteClient: (id: number) => api.delete(`/clients/${id}`),
  listScans: (clientId?: number) => api.get('/scans', { params: { client_id: clientId } }),
  startScan: (data: { client_id: number; target: string }) => api.post('/scans', data),
  getScan: (id: number) => api.get(`/scans/${id}`),
  downloadReport: (id: number) => api.get(`/scans/${id}/report`, { responseType: 'blob' }),
  
  // System
  localIp: () => api.get('/local-ip'),
  systemScan: () => api.post('/system-scan'),
  
  // AI
  chat: (query: string, context?: string) => api.post('/chat', { query, context }),
  
  // Forecast
  forecast: (data: { region: string; year: number; month: string }) => api.post('/forecast', data),
  
  // Threats
  liveThreats: () => api.get('/threats/live'),
  threatHistory: () => api.get('/threats/history'),
  predictThreat: (data: { attack_type: string; industry: string; region: string; severity: number }) => api.post('/threats/predict', data),
  analyzeThreat: (data: any) => api.post('/threats/analyze', data),
  triggerN8n: (data: any) => api.post('/threats/trigger-n8n', data),
};