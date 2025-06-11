import axios from 'axios'
import { ApiResponse, MEGConnectionTestResponse } from '../types'

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    // Extract data from ApiResponse wrapper
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      const apiResponse = response.data as ApiResponse
      if (apiResponse.success) {
        return apiResponse.data
      } else {
        throw new Error(apiResponse.error || 'API request failed')
      }
    }
    return response.data
  },
  (error) => {
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.error || error.response.data?.message || error.message
      throw new Error(message)
    } else if (error.request) {
      // Request was made but no response received
      throw new Error('No response from server. Please check your connection.')
    } else {
      // Something else happened
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
)

// API methods
export const api = {
  // Generic methods
  get: <T = any>(url: string, params?: any): Promise<T> => {
    return apiClient.get(url, { params })
  },

  post: <T = any>(url: string, data?: any, config?: any): Promise<T> => {
    return apiClient.post(url, data, config)
  },

  put: <T = any>(url: string, data?: any): Promise<T> => {
    return apiClient.put(url, data)
  },

  delete: <T = any>(url: string): Promise<T> => {
    return apiClient.delete(url)
  },

  patch: <T = any>(url: string, data?: any): Promise<T> => {
    return apiClient.patch(url, data)
  },

  // MEG Connection endpoints
  meg: {
    getStatus: () => api.get('/api/meg/status'),
    connect: (config: any) => api.post('/api/meg/connect', config),
    disconnect: () => api.post('/api/meg/disconnect'),
    testConnection: (config: any) => api.post('/api/system/test-meg-connection', config), // Corrected endpoint
    getConnectionInfo: () => api.get('/api/meg/info'),
    debugStreamTest: async (config: { host: string; port: number; timeout: number }) => {
      const response = await fetch(`${apiClient.defaults.baseURL}/api/meg/debug_stream_test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.body.getReader();
    },
  },

  // Training endpoints
  training: {
    getSessions: () => api.get('/api/training/sessions'),
    createSession: (config: any) => api.post('/api/training/sessions', config),
    getSession: (id: string) => api.get(`/api/training/sessions/${id}`),
    startSession: (id: string) => api.post(`/api/training/sessions/${id}/start`),
    stopSession: (id: string) => api.post(`/api/training/sessions/${id}/stop`),
    deleteSession: (id: string) => api.delete(`/api/training/sessions/${id}`),
    
    // Trial management
    getTrials: (sessionId: string) => api.get(`/api/training/sessions/${sessionId}/trials`),
    createTrial: (sessionId: string, trial: any) => api.post(`/api/training/sessions/${sessionId}/trials`, trial),
    updateTrial: (sessionId: string, trialId: string, trial: any) => api.put(`/api/training/sessions/${sessionId}/trials/${trialId}`, trial),
  },

  // Inference endpoints
  inference: {
    predict: (data: any) => api.post('/api/inference/predict', data),
    startRealtime: () => api.post('/api/inference/start_realtime'), // Corrected endpoint
    stopRealtime: () => api.post('/api/inference/stop_realtime'),   // Corrected endpoint
    getModels: () => api.get('/api/inference/models'),
    setActiveModel: (modelId: string) => api.post(`/api/inference/models/${modelId}/activate`),
  },

  // System endpoints
  system: {
    getStatus: () => api.get('/api/system/status'),
    getHealth: () => api.get('/api/system/health'),
    getMetrics: () => api.get('/api/system/metrics'),
    getConfig: () => api.get('/api/system/config'),
    updateConfig: (config: any) => api.put('/api/system/config', config),
    testMegConnection: () => api.post<MEGConnectionTestResponse>('/api/system/test-meg-connection'),
    getSensorStatus: () => api.get('/api/system/sensor_status'), // Added sensor status endpoint
  },

  // Phantom controller endpoints
  phantom: {
    getStatus: () => api.get('/api/phantom/status'),
    configure: (config: any) => api.post('/api/phantom/configure', config),
    startCalibration: (config: any) => api.post('/api/phantom/calibration/start', config),
    stopCalibration: () => api.post('/api/phantom/calibration/stop'),
    startTesting: (config: any) => api.post('/api/phantom/testing/start', config),
    stopTesting: () => api.post('/api/phantom/testing/stop'),
    getCalibrationSequences: () => api.get('/api/phantom/calibration/sequences'),
  },

  // Analysis endpoints
  analysis: {
    getChannels: () => api.get('/api/analysis/channels'),
    getChannelAnalysis: (channelId: number) => api.get(`/api/analysis/channels/${channelId}`),
    getSpectralAnalysis: (params?: any) => api.get('/api/analysis/spectral', { params }),
    exportData: (params: any) => api.post('/api/analysis/export', params),
  },

  // Data management endpoints
  data: {
    getSessions: (params?: any) => api.get('/api/data/sessions', { params }),
    getSession: (id: string) => api.get(`/api/data/sessions/${id}`),
    exportSession: (id: string, format: string) => api.post(`/api/data/sessions/${id}/export`, { format }),
    deleteSession: (id: string) => api.delete(`/api/data/sessions/${id}`),
    
    // Model management
    getModels: () => api.get('/api/data/models'),
    getModel: (id: string) => api.get(`/api/data/models/${id}`),
    deleteModel: (id: string) => api.delete(`/api/data/models/${id}`),
    exportModel: (id: string) => api.post(`/api/data/models/${id}/export`),
  },
}

export default api
