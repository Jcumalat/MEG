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
  CheckCircle,
  Loader2 // Import Loader2
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { api } from '../lib/api'
import { MEGConnectionStatus, ChannelAnalysis, PredictionResult, MEGMonitorHookData } from '../types' // Import MEGMonitorHookData
import { clsx } from 'clsx' // Import clsx
import { useMEGMonitorData } from '../hooks/useMEGMonitorData' // Import useMEGMonitorData

interface ChannelGridProps {
  channels: ChannelAnalysis[]
  selectedChannels: number[]
  onChannelSelect: (channelId: number) => void
}

function ChannelGrid({ channels, selectedChannels, onChannelSelect }: ChannelGridProps) {
  return (
    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
      {channels.map((channel) => (
        <div
          key={channel.channelId}
          className={clsx(
            "p-3 rounded-lg border cursor-pointer transition-all duration-200",
            selectedChannels.includes(channel.channelId)
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
              : 'bg-gray-800/50 border-gray-700/50 text-gray-300 hover:bg-gray-700/50',
            channel.signalQuality === 'poor' && 'border-red-500 ring-1 ring-red-500',
            channel.isActive ? 'opacity-100' : 'opacity-50'
          )}
          onClick={() => onChannelSelect(channel.channelId)}
        >
          <div className="text-sm font-medium mb-1">Ch {channel.channelId}</div>
          <div className="text-xs text-gray-400">
            SNR: {channel.snr.toFixed(1)}dB
          </div>
          <div className={clsx(
            "text-xs capitalize font-medium",
            channel.signalQuality === 'excellent' && 'text-emerald-400',
            channel.signalQuality === 'good' && 'text-blue-400',
            channel.signalQuality === 'fair' && 'text-amber-400',
            channel.signalQuality === 'poor' && 'text-red-400'
          )}>
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
      <div className="text-center py-8 text-gray-400">
        <Activity className="h-12 w-12 text-gray-600 mx-auto mb-4" />
        <p className="text-lg font-medium">No predictions yet</p>
        <p className="text-sm">Start real-time inference to see predictions</p>
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
    if (confidence > 0.8) return 'text-emerald-400'
    if (confidence > 0.6) return 'text-amber-400'
    return 'text-red-400'
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-6xl mb-2 text-white">
          {getDirectionIcon(prediction.direction)}
        </div>
        <div className="text-2xl font-bold text-white capitalize">
          {prediction.direction}
        </div>
        <div className={`text-lg font-medium ${getConfidenceColor(prediction.confidence)}`}>
          {(prediction.confidence * 100).toFixed(1)}% confidence
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-300">All Probabilities</h4>
        {Object.entries(prediction.probabilities).map(([direction, probability]) => (
          <div key={direction} className="flex items-center justify-between">
            <span className="text-sm capitalize text-gray-200">{direction}</span>
            <div className="flex items-center space-x-2 w-full ml-4">
              <div className="flex-1 bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${probability * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium w-12 text-right text-gray-100">
                {(probability * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-700/50">
        Processing time: {prediction.processingTime.toFixed(1)}ms
      </div>
    </div>
  )
}

export default function Monitoring() {
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [selectedChannels, setSelectedChannels] = useState<number[]>([])
  const [showChannelGrid, setShowChannelGrid] = useState(true)

  // Fetch MEG status
  const { data: megStatus } = useQuery<MEGConnectionStatus>({
    queryKey: ['meg-status'],
    queryFn: () => api.meg.getStatus(),
    refetchInterval: 2000,
  })

  // Fetch channel analysis
  const { data: channelsData } = useQuery<ChannelAnalysis[]>({
    queryKey: ['channel-analysis'],
    queryFn: () => api.analysis.getChannels(),
    refetchInterval: 5000,
  })
  const channels = channelsData ?? []; // Ensure channels is always an array

  // Fetch latest prediction
  const { data: latestPrediction } = useQuery<PredictionResult>({
    queryKey: ['latest-prediction'],
    queryFn: () => api.inference.predict({}),
    enabled: isMonitoring,
    refetchInterval: 500,
  })

  // Fetch real-time MEG monitor data
  const { data: monitorData, isLoading: isLoadingMonitorData, error: monitorDataError } = useMEGMonitorData();

  // Prepare data for Recharts
  const signalData = React.useMemo(() => {
    if (!monitorData || monitorData.data.length === 0) {
      return []
    }

    // Assuming monitorData.data is an array of samples, where each sample is an array of channel values
    // We need to transform it into an array of objects for Recharts, with a timestamp and values for selected channels
    const transformedData: { timestamp: number; [key: string]: number }[] = []
    const now = Date.now()
    const intervalMs = 1000 / monitorData.samplingRate // Milliseconds per sample

    // For simplicity, let's just plot the first selected channel, or channel 1 if none selected
    const channelToPlot = selectedChannels.length > 0 ? selectedChannels[0] : 1;

    monitorData.data.forEach((sample: number[], index: number) => {
      // Ensure the channel exists in the sample
      if (channelToPlot > 0 && channelToPlot <= monitorData.channels) {
        transformedData.push({
          timestamp: now + index * intervalMs, // Approximate timestamp
          [`channel${channelToPlot}`]: sample[channelToPlot - 1], // Adjust for 0-indexed array
        })
      }
    })
    return transformedData
  }, [monitorData, selectedChannels])

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

  const activeChannels = channels.filter(ch => ch.isActive);
  const channelQualityStats = {
    excellent: channels.filter(ch => ch.signalQuality === 'excellent').length,
    good: channels.filter(ch => ch.signalQuality === 'good').length,
    fair: channels.filter(ch => ch.signalQuality === 'fair').length,
    poor: channels.filter(ch => ch.signalQuality === 'poor').length,
  };

  return (
    <div className="space-y-8 p-6 bg-gray-950 min-h-screen text-gray-100">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-white mb-3">Real-time Monitoring</h1>
        <p className="text-gray-400 text-lg">
          Monitor MEG signals and real-time BCI predictions
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3 mb-6">
        <button
          onClick={() => setShowChannelGrid(!showChannelGrid)}
          className="flex items-center px-4 py-2 border border-gray-700 text-sm font-medium rounded-md shadow-sm text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
        >
          {showChannelGrid ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
          {showChannelGrid ? 'Hide' : 'Show'} Channels
        </button>
        {isMonitoring ? (
          <button
            onClick={handleStopMonitoring}
            className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <Pause className="h-4 w-4 mr-2" />
            Stop Monitoring
          </button>
        ) : (
          <button
            onClick={handleStartMonitoring}
            className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            disabled={!megStatus?.isConnected}
          >
            <Play className="h-4 w-4 mr-2" />
            Start Monitoring
          </button>
        )}
      </div>

      {/* Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
          <div className="card-content">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={clsx(
                  "p-3 rounded-lg",
                  megStatus?.isConnected ? 'bg-emerald-500' : 'bg-red-500'
                )}>
                  {megStatus?.isConnected ? <Wifi className="h-6 w-6 text-white" /> : <WifiOff className="h-6 w-6 text-white" />}
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-400">MEG Connection</p>
                <p className="text-2xl font-semibold text-white">
                  {megStatus?.isConnected ? 'Connected' : 'Disconnected'}
                </p>
                <p className="text-sm text-gray-500">
                  {megStatus?.samplingRate ? `${megStatus.samplingRate} Hz` : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
          <div className="card-content">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-lg bg-blue-500">
                  <Activity className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-400">Active Channels</p>
                <p className="text-2xl font-semibold text-white">
                  {activeChannels.length}
                </p>
                <p className="text-sm text-gray-500">
                  of {channels.length} total
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
          <div className="card-content">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={clsx(
                  "p-3 rounded-lg",
                  isMonitoring ? 'bg-emerald-500' : 'bg-gray-500'
                )}>
                  {isMonitoring ? <CheckCircle className="h-6 w-6 text-white" /> : <AlertTriangle className="h-6 w-6 text-white" />}
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-400">Monitoring Status</p>
                <p className="text-2xl font-semibold text-white">
                  {isMonitoring ? 'Active' : 'Inactive'}
                </p>
                <p className="text-sm text-gray-500">
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
          <div className="card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
            <div className="card-header mb-4">
              <h3 className="text-xl font-semibold text-white">Real-time Signal</h3>
            </div>
            <div className="card-content">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={signalData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                      stroke="#9ca3af"
                    />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                      contentStyle={{
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        border: '1px solid rgba(75, 85, 99, 0.5)',
                        borderRadius: '8px',
                        color: '#d1d5db'
                      }}
                    />
                    {selectedChannels.length > 0 ? (
                      selectedChannels.map(channelId => (
                        <Line
                          key={`channel-${channelId}`}
                          type="monotone"
                          dataKey={`channel${channelId}`}
                          stroke={`hsl(${(channelId * 10) % 360}, 70%, 60%)`} // Dynamic color
                          strokeWidth={1}
                          name={`Channel ${channelId}`}
                          dot={false}
                        />
                      ))
                    ) : (
                      <Line
                        type="monotone"
                        dataKey="channel1" // Default to channel 1 if no selection
                        stroke="#8884d8"
                        strokeWidth={1}
                        name="Channel 1 (Default)"
                        dot={false}
                      />
                    )}
                    {monitorDataError && (
                      <ReferenceLine y={0} stroke="red" strokeDasharray="3 3" label={{ value: `Error: ${monitorDataError.message}`, fill: 'red', position: 'top' }} />
                    )}
                    {isLoadingMonitorData && (
                      <ReferenceLine y={0} stroke="gray" strokeDasharray="3 3" label={{ value: "Loading data...", fill: 'gray', position: 'top' }} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {monitorDataError && (
                <div className="text-red-500 text-sm mt-2">
                  Error loading MEG data: {monitorDataError.message}. Please ensure the MEG system is connected and streaming.
                </div>
              )}
              {isLoadingMonitorData && (
                <div className="text-gray-500 text-sm mt-2">
                  Loading real-time MEG data...
                </div>
              )}
              {!monitorData && !isLoadingMonitorData && !monitorDataError && (
                <div className="text-gray-500 text-sm mt-2">
                  No MEG data available. Ensure the MEG system is connected and streaming.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Prediction Display */}
        <div className="lg:col-span-1">
          <div className="card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
            <div className="card-header mb-4">
              <h3 className="text-xl font-semibold text-white">Current Prediction</h3>
            </div>
            <div className="card-content">
              <PredictionDisplay prediction={latestPrediction || null} />
            </div>
          </div>
        </div>
      </div>

      {/* Channel Grid */}
      {showChannelGrid && (
        <div className="card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
          <div className="card-header mb-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-white">Channel Status</h3>
              <div className="flex items-center space-x-4 text-sm text-gray-300">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded bg-emerald-500 mr-2" />
                  <span>Active</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded bg-gray-500 mr-2" />
                  <span>Inactive</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded bg-red-500 mr-2" />
                  <span>Poor Quality</span>
                </div>
              </div>
            </div>
          </div>
          <div className="card-content">
            {channels.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Activity className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-lg font-medium">No channel data available</p>
                <p className="text-sm">Connect to MEG system to see channel status</p>
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
                    <div className="text-2xl font-bold text-emerald-400">{channelQualityStats.excellent}</div>
                    <div className="text-sm text-gray-400">Excellent</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{channelQualityStats.good}</div>
                    <div className="text-sm text-gray-400">Good</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-400">{channelQualityStats.fair}</div>
                    <div className="text-sm text-gray-400">Fair</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-400">{channelQualityStats.poor}</div>
                    <div className="text-sm text-gray-400">Poor</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Selected Channels Info */}
      {selectedChannels.length > 0 && (
        <div className="card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
          <div className="card-header mb-4">
            <h3 className="text-xl font-semibold text-white">
              Selected Channels ({selectedChannels.length})
            </h3>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedChannels.map(channelId => {
                const channel = channels.find(ch => ch.channelId === channelId)
                if (!channel) return null
                
                return (
                  <div key={channelId} className="border border-gray-700 rounded-lg p-4 bg-gray-900/50">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-white">Channel {channel.channelId}</h4>
                      <span className={clsx(
                        "text-xs px-2 py-1 rounded-full font-medium",
                        channel.signalQuality === 'excellent' && 'bg-emerald-500/20 text-emerald-400',
                        channel.signalQuality === 'good' && 'bg-blue-500/20 text-blue-400',
                        channel.signalQuality === 'fair' && 'bg-amber-500/20 text-amber-400',
                        channel.signalQuality === 'poor' && 'bg-red-500/20 text-red-400'
                      )}>
                        {channel.signalQuality}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-400">
                      <div>SNR: {channel.snr.toFixed(1)} dB</div>
                      <div>Variance: {channel.variance.toExponential(2)}</div>
                      <div>Updated: {new Date(channel.lastUpdate).toLocaleTimeString()}</div>
                    </div>
                    {channel.artifacts.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs text-red-400">
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
