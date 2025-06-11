import React, { useState } from 'react'
import { 
  Settings, 
  Wifi, 
  Brain, 
  Cpu, 
  Database, 
  Save, 
  RefreshCw, 
  TestTube,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { MEGConfig, SignalProcessingConfig, PhantomConfig, MEGConnectionTestResponse } from '../types'
import toast from 'react-hot-toast'

const defaultMEGConfig: MEGConfig = {
  host: '192.168.0.10',
  port: 8089,
  samplingRate: 375,
  channels: 192,
  timeout: 10000
}

const defaultSignalConfig: SignalProcessingConfig = {
  filterLow: 8,
  filterHigh: 30,
  filterOrder: 4,
  cspComponents: 8,
  windowSize: 750,
  noiseReduction: {
    enabled: true,
    methods: ['svd', 'spatial']
  }
}

const defaultPhantomConfig: PhantomConfig = {
  frequency: 10,
  amplitude: 1.0,
  duration: 5,
  channels: [1, 2, 3, 4],
  waveform: 'sine'
}

interface ConfigSectionProps {
  title: string
  description: string
  icon: React.ElementType
  children: React.ReactNode
}

function ConfigSection({ title, description, icon: Icon, children }: ConfigSectionProps) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center">
          <Icon className="h-5 w-5 text-gray-500 mr-2" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
      </div>
      <div className="card-content">
        {children}
      </div>
    </div>
  )
}

export default function Configuration() {
  const [megConfig, setMegConfig] = useState<MEGConfig>(defaultMEGConfig)
  const [signalConfig, setSignalConfig] = useState<SignalProcessingConfig>(defaultSignalConfig)
  const [phantomConfig, setPhantomConfig] = useState<PhantomConfig>(defaultPhantomConfig)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionTestResult, setConnectionTestResult] = useState<MEGConnectionTestResponse | null>(null)
  const queryClient = useQueryClient()

  // Fetch current configuration
  const { data: currentConfig, isLoading } = useQuery({
    queryKey: ['system-config'],
    queryFn: () => api.system.getConfig(),
  })

  // Update local state when data is fetched
  React.useEffect(() => {
    if (currentConfig) {
      if (currentConfig.meg) setMegConfig(currentConfig.meg)
      if (currentConfig.signalProcessing) setSignalConfig(currentConfig.signalProcessing)
      if (currentConfig.phantom) setPhantomConfig(currentConfig.phantom)
    }
  }, [currentConfig])

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: (config: any) => api.system.updateConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] })
      toast.success('Configuration saved successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to save configuration: ${error.message}`)
    }
  })

  // Test MEG connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: (config: MEGConfig) => api.meg.testConnection(config),
    onSuccess: (data: MEGConnectionTestResponse) => {
      console.log('MEG connection test success:', data)
      setConnectionTestResult(data)
      if (data.status === 'success') {
        toast.success('MEG connection test successful')
      } else {
        toast.error(`Connection test failed: ${data.message}`)
      }
    },
    onError: (error: Error) => {
      console.error('MEG connection test error:', error)
      setConnectionTestResult({ status: 'error', message: error.message })
      toast.error(`Connection test failed: ${error.message}`)
    }
  })

  const handleSaveConfig = () => {
    const config = {
      meg: megConfig,
      signalProcessing: signalConfig,
      phantom: phantomConfig
    }
    saveConfigMutation.mutate(config)
  }

  const handleTestConnection = async () => {
    console.log('handleTestConnection called')
    setTestingConnection(true)
    try {
      await testConnectionMutation.mutateAsync(megConfig)
    } finally {
      setTestingConnection(false)
    }
  }

  const handleResetToDefaults = () => {
    setMegConfig(defaultMEGConfig)
    setSignalConfig(defaultSignalConfig)
    setPhantomConfig(defaultPhantomConfig)
    toast('Configuration reset to defaults', { icon: 'ℹ️' })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Configuration</h1>
          <p className="text-gray-600">
            Configure MEG connection, signal processing, and phantom controller settings
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleResetToDefaults}
            className="btn-secondary"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </button>
          <button
            onClick={handleSaveConfig}
            disabled={saveConfigMutation.isPending}
            className="btn-primary"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Configuration
          </button>
        </div>
      </div>

      {/* MEG Connection Configuration */}
      <ConfigSection
        title="MEG Connection"
        description="Configure connection to the MEG system"
        icon={Wifi}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="label">Host Address</label>
              <input
                type="text"
                className="input"
                value={megConfig.host}
                onChange={(e) => setMegConfig({ ...megConfig, host: e.target.value })}
                placeholder="192.168.0.10"
              />
              <p className="text-xs text-gray-500 mt-1">
                IP address of the MEG system
              </p>
            </div>
            
            <div>
              <label className="label">Port</label>
              <input
                type="number"
                className="input"
                value={megConfig.port}
                onChange={(e) => setMegConfig({ ...megConfig, port: parseInt(e.target.value) })}
                min="1"
                max="65535"
              />
              <p className="text-xs text-gray-500 mt-1">
                TCP port for MEG communication
              </p>
            </div>

            <div>
              <label className="label">Timeout (ms)</label>
              <input
                type="number"
                className="input"
                value={megConfig.timeout}
                onChange={(e) => setMegConfig({ ...megConfig, timeout: parseInt(e.target.value) })}
                min="1000"
                max="60000"
                step="1000"
              />
              <p className="text-xs text-gray-500 mt-1">
                Connection timeout in milliseconds
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">Sampling Rate (Hz)</label>
              <select
                className="input"
                value={megConfig.samplingRate}
                onChange={(e) => setMegConfig({ ...megConfig, samplingRate: parseInt(e.target.value) })}
              >
                <option value={250}>250 Hz</option>
                <option value={375}>375 Hz</option>
                <option value={500}>500 Hz</option>
                <option value={1000}>1000 Hz</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                MEG system sampling frequency
              </p>
            </div>

            <div>
              <label className="label">Channels</label>
              <input
                type="number"
                className="input"
                value={megConfig.channels}
                onChange={(e) => setMegConfig({ ...megConfig, channels: parseInt(e.target.value) })}
                min="1"
                max="512"
              />
              <p className="text-xs text-gray-500 mt-1">
                Number of MEG channels
              </p>
            </div>

            <div className="pt-4">
              {/* This button attempts to connect to the MEG system */}
              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="btn-secondary w-full"
              >
                <TestTube className="h-4 w-4 mr-2" />
                {testingConnection ? 'Testing...' : 'Test Connection'}
              </button>
              {connectionTestResult && (
                <div className={`mt-4 p-3 rounded-md text-sm ${
                  connectionTestResult.status === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <div className="flex items-center">
                    {connectionTestResult.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
                    )}
                    <span className="font-medium">Connection Test Result:</span>
                  </div>
                  <p className="mt-2">
                    {connectionTestResult.status === 'success' ? (
                      <>
                        Connected to {megConfig.host}:{megConfig.port}. Data frames found: {connectionTestResult.framesFound || 'N/A'}. Throughput: {connectionTestResult.throughput?.toFixed(2) || 'N/A'} MB/s.
                      </>
                    ) : (
                      `Failed to connect to ${megConfig.host}:${megConfig.port}. ${connectionTestResult.message}`
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </ConfigSection>

      {/* Signal Processing Configuration */}
      <ConfigSection
        title="Signal Processing"
        description="Configure filtering and feature extraction parameters"
        icon={Brain}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="label">Low-pass Filter (Hz)</label>
              <input
                type="number"
                className="input"
                value={signalConfig.filterLow}
                onChange={(e) => setSignalConfig({ ...signalConfig, filterLow: parseFloat(e.target.value) })}
                min="0.1"
                max="100"
                step="0.1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lower cutoff frequency for bandpass filter
              </p>
            </div>

            <div>
              <label className="label">High-pass Filter (Hz)</label>
              <input
                type="number"
                className="input"
                value={signalConfig.filterHigh}
                onChange={(e) => setSignalConfig({ ...signalConfig, filterHigh: parseFloat(e.target.value) })}
                min="1"
                max="200"
                step="0.1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Upper cutoff frequency for bandpass filter
              </p>
            </div>

            <div>
              <label className="label">Filter Order</label>
              <select
                className="input"
                value={signalConfig.filterOrder}
                onChange={(e) => setSignalConfig({ ...signalConfig, filterOrder: parseInt(e.target.value) })}
              >
                <option value={2}>2nd Order</option>
                <option value={4}>4th Order</option>
                <option value={6}>6th Order</option>
                <option value={8}>8th Order</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Butterworth filter order
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">CSP Components</label>
              <input
                type="number"
                className="input"
                value={signalConfig.cspComponents}
                onChange={(e) => setSignalConfig({ ...signalConfig, cspComponents: parseInt(e.target.value) })}
                min="2"
                max="32"
              />
              <p className="text-xs text-gray-500 mt-1">
                Number of CSP spatial filters
              </p>
            </div>

            <div>
              <label className="label">Window Size (samples)</label>
              <input
                type="number"
                className="input"
                value={signalConfig.windowSize}
                onChange={(e) => setSignalConfig({ ...signalConfig, windowSize: parseInt(e.target.value) })}
                min="100"
                max="2000"
                step="50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Analysis window size for feature extraction
              </p>
            </div>

            <div>
              <label className="label">Noise Reduction</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={signalConfig.noiseReduction.enabled}
                    onChange={(e) => setSignalConfig({
                      ...signalConfig,
                      noiseReduction: {
                        ...signalConfig.noiseReduction,
                        enabled: e.target.checked
                      }
                    })}
                    className="mr-2"
                  />
                  <span className="text-sm">Enable noise reduction</span>
                </label>
                
                {signalConfig.noiseReduction.enabled && (
                  <div className="ml-6 space-y-2">
                    {['svd', 'spatial', 'temporal'].map((method) => (
                      <label key={method} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={signalConfig.noiseReduction.methods.includes(method)}
                          onChange={(e) => {
                            const methods = e.target.checked
                              ? [...signalConfig.noiseReduction.methods, method]
                              : signalConfig.noiseReduction.methods.filter(m => m !== method)
                            setSignalConfig({
                              ...signalConfig,
                              noiseReduction: {
                                ...signalConfig.noiseReduction,
                                methods
                              }
                            })
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm capitalize">{method} denoising</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </ConfigSection>

      {/* Phantom Controller Configuration */}
      <ConfigSection
        title="Phantom Controller"
        description="Configure phantom signal generator for testing and calibration"
        icon={TestTube}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="label">Frequency (Hz)</label>
              <input
                type="number"
                className="input"
                value={phantomConfig.frequency}
                onChange={(e) => setPhantomConfig({ ...phantomConfig, frequency: parseFloat(e.target.value) })}
                min="0.1"
                max="100"
                step="0.1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Phantom signal frequency
              </p>
            </div>

            <div>
              <label className="label">Amplitude</label>
              <input
                type="number"
                className="input"
                value={phantomConfig.amplitude}
                onChange={(e) => setPhantomConfig({ ...phantomConfig, amplitude: parseFloat(e.target.value) })}
                min="0.1"
                max="10"
                step="0.1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Signal amplitude multiplier
              </p>
            </div>

            <div>
              <label className="label">Duration (seconds)</label>
              <input
                type="number"
                className="input"
                value={phantomConfig.duration}
                onChange={(e) => setPhantomConfig({ ...phantomConfig, duration: parseInt(e.target.value) })}
                min="1"
                max="300"
              />
              <p className="text-xs text-gray-500 mt-1">
                Default test duration
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">Waveform</label>
              <select
                className="input"
                value={phantomConfig.waveform}
                onChange={(e) => setPhantomConfig({ ...phantomConfig, waveform: e.target.value as any })}
              >
                <option value="sine">Sine Wave</option>
                <option value="square">Square Wave</option>
                <option value="triangle">Triangle Wave</option>
                <option value="noise">White Noise</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Phantom signal waveform type
              </p>
            </div>

            <div>
              <label className="label">Target Channels</label>
              <input
                type="text"
                className="input"
                value={phantomConfig.channels.join(', ')}
                onChange={(e) => {
                  const channels = e.target.value
                    .split(',')
                    .map(ch => parseInt(ch.trim()))
                    .filter(ch => !isNaN(ch))
                  setPhantomConfig({ ...phantomConfig, channels })
                }}
                placeholder="1, 2, 3, 4"
              />
              <p className="text-xs text-gray-500 mt-1">
                Comma-separated list of channel numbers
              </p>
            </div>
          </div>
        </div>
      </ConfigSection>

      {/* System Information */}
      <ConfigSection
        title="System Information"
        description="Current system status and capabilities"
        icon={Info}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Hardware</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>CPU: Multi-core processor</div>
              <div>Memory: 16+ GB RAM recommended</div>
              <div>Storage: SSD recommended</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Software</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Python: 3.8+</div>
              <div>NumPy: Scientific computing</div>
              <div>SciPy: Signal processing</div>
              <div>Scikit-learn: Machine learning</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Capabilities</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Real-time processing: ✓</div>
              <div>Multi-channel support: ✓</div>
              <div>CSP feature extraction: ✓</div>
              <div>Multiple classifiers: ✓</div>
            </div>
          </div>
        </div>
      </ConfigSection>

      {/* Configuration Status */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-3" />
          <div>
            <h3 className="text-sm font-medium text-blue-900">Configuration Notes</h3>
            <div className="text-sm text-blue-700 mt-1 space-y-1">
              <p>• Changes require system restart to take full effect</p>
              <p>• Test MEG connection before starting data collection</p>
              <p>• Signal processing parameters affect classification performance</p>
              <p>• Phantom controller is used for system testing and calibration</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
