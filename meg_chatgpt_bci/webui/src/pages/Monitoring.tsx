import React, { useState, useEffect } from 'react'
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Eye, 
  EyeOff, 
  Pause, 
  Play, 
  Settings,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../lib/api'
import { MEGConnectionStatus, ChannelAnalysis, PredictionResult } from '../types'

// Mock real-time data for demonstration
const generateMockSignalData = () => {
  const data = []
  const now = Date.now()
  for (let i = 0; i < 100; i++) {
    data.push({
      timestamp: now - (100 - i) * 100,
      raw: Math.sin(i * 0.1) * 50 + Math.random() * 20 - 10,
      filtered: Math.sin(i * 0.1) * 40 + Math.random() * 10 - 5,
    })
  }
  return data
}

interface ChannelGridProps {
  channels: ChannelAnalysis[]
  selectedChannels: number[]
  onChannelSelect: (channelId: number) => void
}

function ChannelGrid({ channels, selectedChannels, onChannelSelect }: ChannelGridProps) {
  return (
    <div className="channel-grid">
      {channels.map((channel) => (
        <div
          key={channel.channelId}
          className={`channel-item cursor-pointer transition-all ${
            channel.isActive 
              ? selectedChannels.includes(channel.channelId)
                ? 'channel-active ring-2 ring-blue-500'
                : 'channel-active'
              : 'channel-inactive'
          } ${
            channel.signalQuality === 'poor' ? 'channel-error' : ''
          }`}
          onClick={() => onChannelSelect(channel.channelId)}
        >
          <div className="text-xs font-medium">Ch {channel.channelId}</div>
          <div className="text-xs">
            SNR: {channel.snr.toFixed(1)}dB
          </div>
          <div className="text-xs capitalize">
            {channel.signalQuality}
          </div>
        </div>
      ))}
    </div>
  )
}

interface PredictionDisplayProps {
  prediction: PredictionResult | null
}

function PredictionDisplay({ prediction }: PredictionDisplayProps) {
  if (!prediction) {
    return (
      <div className="text-center py-8">
        <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No predictions yet</p>
        <p className="text-sm text-gray-400">Start real-time inference to see predictions</p>
      </div>
    )
  }

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'up': return '↑'
      case 'down': return '↓'
      case 'left': return '←'
      case 'right': return '→'
      case 'rest': return '⊙'
      default: return '?'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return 'text-green-600'
    if (confidence > 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-6xl mb-2">
          {getDirectionIcon(prediction.direction)}
        </div>
        <div className="text-2xl font-bold text-gray-900 capitalize">
          {prediction.direction}
        </div>
        <div className={`text-lg font-medium ${getConfidenceColor(prediction.confidence)}`}>
          {(prediction.confidence * 100).toFixed(1)}% confidence
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">All Probabilities</h4>
        {Object.entries(prediction.probabilities).map(([direction, probability]) => (
          <div key={direction} className="flex items-center justify-between">
            <span className="text-sm capitalize">{direction}</span>
            <div className="flex items-center space-x-2">
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${probability * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium w-12 text-right">
                {(probability * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-500 text-center">
        Processing time: {prediction.processingTime.toFixed(1)}ms
      </div>
    </div>
  )
}

export default function Monitoring() {
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [selectedChannels, setSelectedChannels] = useState<number[]>([])
  const [signalData, setSignalData] = useState(generateMockSignalData())
  const [showChannelGrid, setShowChannelGrid] = useState(true)

  // Fetch MEG status
  const { data: megStatus } = useQuery<MEGConnectionStatus>({
    queryKey: ['meg-status'],
    queryFn: () => api.meg.getStatus(),
    refetchInterval: 2000,
  })

  // Fetch channel analysis
  const { data: channels = [] } = useQuery<ChannelAnalysis[]>({
    queryKey: ['channel-analysis'],
    queryFn: () => api.analysis.getChannels(),
    refetchInterval: 5000,
  })

  // Fetch latest prediction
  const { data: latestPrediction } = useQuery<PredictionResult>({
    queryKey: ['latest-prediction'],
    queryFn: () => api.inference.predict({}),
    enabled: isMonitoring,
    refetchInterval: 500,
  })

  // Simulate real-time signal updates
  useEffect(() => {
    if (!isMonitoring) return

    const interval = setInterval(() => {
      setSignalData(prev => {
        const newData = [...prev.slice(1)]
        const lastTimestamp = newData[newData.length - 1]?.timestamp || Date.now()
        newData.push({
          timestamp: lastTimestamp + 100,
          raw: Math.sin(Date.now() * 0.001) * 50 + Math.random() * 20 - 10,
          filtered: Math.sin(Date.now() * 0.001) * 40 + Math.random() * 10 - 5,
        })
        return newData
      })
    }, 100)

    return () => clearInterval(interval)
  }, [isMonitoring])

  const handleChannelSelect = (channelId: number) => {
    setSelectedChannels(prev => 
      prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    )
  }

  const handleStartMonitoring = async () => {
    try {
      await api.inference.startRealtime()
      setIsMonitoring(true)
    } catch (error) {
      console.error('Failed to start monitoring:', error)
    }
  }

  const handleStopMonitoring = async () => {
    try {
      await api.inference.stopRealtime()
      setIsMonitoring(false)
    } catch (error) {
      console.error('Failed to stop monitoring:', error)
    }
  }

  const activeChannels = channels.filter(ch => ch.isActive)
  const channelQualityStats = {
    excellent: channels.filter(ch => ch.signalQuality === 'excellent').length,
    good: channels.filter(ch => ch.signalQuality === 'good').length,
    fair: channels.filter(ch => ch.signalQuality === 'fair').length,
    poor: channels.filter(ch => ch.signalQuality === 'poor').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Real-time Monitoring</h1>
          <p className="text-gray-600">
            Monitor MEG signals and real-time BCI predictions
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowChannelGrid(!showChannelGrid)}
            className="btn-secondary"
          >
            {showChannelGrid ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showChannelGrid ? 'Hide' : 'Show'} Channels
          </button>
          {isMonitoring ? (
            <button
              onClick={handleStopMonitoring}
              className="btn-error"
            >
              <Pause className="h-4 w-4 mr-2" />
              Stop Monitoring
            </button>
          ) : (
            <button
              onClick={handleStartMonitoring}
              className="btn-success"
              disabled={!megStatus?.isConnected}
            >
              <Play className="h-4 w-4 mr-2" />
              Start Monitoring
            </button>
          )}
        </div>
      </div>

      {/* Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`p-3 rounded-lg ${megStatus?.isConnected ? 'bg-green-500' : 'bg-red-500'}`}>
                  {megStatus?.isConnected ? <Wifi className="h-6 w-6 text-white" /> : <WifiOff className="h-6 w-6 text-white" />}
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">MEG Connection</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {megStatus?.isConnected ? 'Connected' : 'Disconnected'}
                </p>
                <p className="text-sm text-gray-600">
                  {megStatus?.samplingRate ? `${megStatus.samplingRate} Hz` : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-blue-500">
                  <Activity className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Active Channels</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {activeChannels.length}
                </p>
                <p className="text-sm text-gray-600">
                  of {channels.length} total
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`p-3 rounded-lg ${isMonitoring ? 'bg-green-500' : 'bg-gray-500'}`}>
                  {isMonitoring ? <CheckCircle className="h-6 w-6 text-white" /> : <AlertTriangle className="h-6 w-6 text-white" />}
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Monitoring Status</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {isMonitoring ? 'Active' : 'Inactive'}
                </p>
                <p className="text-sm text-gray-600">
                  Real-time inference
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Monitoring Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Signal Visualization */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Real-time Signal</h3>
            </div>
            <div className="card-content">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={signalData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="raw" 
                      stroke="#ef4444" 
                      strokeWidth={1}
                      name="Raw Signal"
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="filtered" 
                      stroke="#22c55e" 
                      strokeWidth={2}
                      name="Filtered Signal"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Prediction Display */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Current Prediction</h3>
            </div>
            <div className="card-content">
              <PredictionDisplay prediction={latestPrediction || null} />
            </div>
          </div>
        </div>
      </div>

      {/* Channel Grid */}
      {showChannelGrid && (
        <div className="card">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Channel Status</h3>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded bg-green-100 border border-green-200 mr-2" />
                  <span>Active</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200 mr-2" />
                  <span>Inactive</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded bg-red-100 border border-red-200 mr-2" />
                  <span>Poor Quality</span>
                </div>
              </div>
            </div>
          </div>
          <div className="card-content">
            {channels.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No channel data available</p>
                <p className="text-sm text-gray-400">Connect to MEG system to see channel status</p>
              </div>
            ) : (
              <>
                <ChannelGrid 
                  channels={channels}
                  selectedChannels={selectedChannels}
                  onChannelSelect={handleChannelSelect}
                />
                
                {/* Channel Quality Summary */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{channelQualityStats.excellent}</div>
                    <div className="text-sm text-gray-500">Excellent</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{channelQualityStats.good}</div>
                    <div className="text-sm text-gray-500">Good</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{channelQualityStats.fair}</div>
                    <div className="text-sm text-gray-500">Fair</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{channelQualityStats.poor}</div>
                    <div className="text-sm text-gray-500">Poor</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Selected Channels Info */}
      {selectedChannels.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">
              Selected Channels ({selectedChannels.length})
            </h3>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedChannels.map(channelId => {
                const channel = channels.find(ch => ch.channelId === channelId)
                if (!channel) return null
                
                return (
                  <div key={channelId} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">Channel {channel.channelId}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        channel.signalQuality === 'excellent' ? 'bg-green-100 text-green-800' :
                        channel.signalQuality === 'good' ? 'bg-blue-100 text-blue-800' :
                        channel.signalQuality === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {channel.signalQuality}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div>SNR: {channel.snr.toFixed(1)} dB</div>
                      <div>Variance: {channel.variance.toExponential(2)}</div>
                      <div>Updated: {new Date(channel.lastUpdate).toLocaleTimeString()}</div>
                    </div>
                    {channel.artifacts.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs text-red-600">
                          Artifacts: {channel.artifacts.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
