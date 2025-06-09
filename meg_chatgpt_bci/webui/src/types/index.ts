// MEG System Types
export interface MEGConnectionStatus {
  isConnected: boolean
  connectionType: 'TCP' | 'LSL' | null
  host: string
  port: number
  samplingRate: number
  channels: number
  lastUpdate: string
}

export interface MEGData {
  timestamp: number
  samples: number[][]
  channels: number
  samplingRate: number
}

export interface MEGConfig {
  host: string
  port: number
  samplingRate: number
  channels: number
  timeout: number
}

// Training Types
export interface TrainingSession {
  id: string
  name: string
  startTime: string
  endTime?: string
  status: 'active' | 'completed' | 'failed'
  trialsCompleted: number
  totalTrials: number
  directions: string[]
  conditions: string[]
}

export interface TrainingTrial {
  id: string
  sessionId: string
  direction: 'up' | 'down' | 'left' | 'right' | 'rest'
  condition: 'actual' | 'imagined'
  startTime: string
  duration: number
  data?: MEGData
  quality: 'good' | 'fair' | 'poor'
}

export interface TrainingConfig {
  trialsPerDirection: number
  trialDuration: number
  restDuration: number
  cueDuration: number
  directions: string[]
  conditions: string[]
}

// Classification Types
export interface ClassificationModel {
  id: string
  name: string
  type: 'LDA' | 'SVM' | 'RandomForest'
  accuracy: number
  createdAt: string
  trainingSessionId: string
  features: string[]
  isActive: boolean
}

export interface PredictionResult {
  direction: 'up' | 'down' | 'left' | 'right' | 'rest'
  confidence: number
  probabilities: Record<string, number>
  timestamp: string
  processingTime: number
}

// Signal Processing Types
export interface SignalProcessingConfig {
  filterLow: number
  filterHigh: number
  filterOrder: number
  cspComponents: number
  windowSize: number
  noiseReduction: {
    enabled: boolean
    methods: string[]
  }
}

export interface FeatureExtractionResult {
  features: number[]
  method: 'CSP' | 'PowerBands' | 'Combined'
  channels: number
  processingTime: number
  quality: number
}

// Phantom Controller Types
export interface PhantomConfig {
  frequency: number
  amplitude: number
  duration: number
  channels: number[]
  waveform: 'sine' | 'square' | 'triangle' | 'noise'
}

export interface PhantomStatus {
  isActive: boolean
  mode: 'idle' | 'calibration' | 'testing' | 'noise_measurement'
  elapsedTime: number
  remainingTime: number
  config?: PhantomConfig
}

// Performance Monitoring Types
export interface PerformanceMetrics {
  timestamp: string
  cpuUsage: number
  memoryUsage: number
  processingLatency: number
  dataRate: number
  queueSize: number
  droppedSamples: number
}

export interface SystemHealth {
  megConnection: 'healthy' | 'warning' | 'error'
  signalProcessing: 'healthy' | 'warning' | 'error'
  classification: 'healthy' | 'warning' | 'error'
  storage: 'healthy' | 'warning' | 'error'
  overall: 'healthy' | 'warning' | 'error'
  lastCheck: string
}

// Analysis Types
export interface ChannelAnalysis {
  channelId: number
  name: string
  isActive: boolean
  signalQuality: 'excellent' | 'good' | 'fair' | 'poor'
  snr: number
  variance: number
  artifacts: string[]
  lastUpdate: string
}

export interface SpectralAnalysis {
  frequencies: number[]
  powerSpectrum: number[]
  bands: {
    delta: number
    theta: number
    alpha: number
    beta: number
    gamma: number
  }
  peakFrequency: number
  bandwidth: number
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasNext: boolean
  hasPrev: boolean
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'meg_data' | 'prediction' | 'status' | 'error' | 'training_update'
  payload: any
  timestamp: string
}

// UI State Types
export interface UIState {
  sidebarOpen: boolean
  currentPage: string
  theme: 'light' | 'dark'
  notifications: Notification[]
}

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: string
  read: boolean
}

// Chart Data Types
export interface ChartDataPoint {
  timestamp: number
  value: number
  label?: string
}

export interface TimeSeriesData {
  name: string
  data: ChartDataPoint[]
  color: string
}
