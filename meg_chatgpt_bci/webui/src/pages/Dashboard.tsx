import React from 'react'
import { 
  Activity, 
  Brain, 
  Cpu, 
  Database, 
  TrendingUp, 
  Users, 
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { api } from '../lib/api'
import { SystemHealth, PerformanceMetrics, MEGConnectionStatus, MEGConfig } from '../types'
import ConnectionStatus from '../components/ConnectionStatus'
import SignalVisualization from '../components/SignalVisualization'
import { useMEGMonitorData } from '../hooks/useMEGMonitorData' // Import the new hook
import { SensorGrid } from '../components/SensorGrid' // Import SensorGrid
import { useSensorStatus } from '../hooks/useSensorStatus' // Import useSensorStatus

// Mock data for demonstration
const mockPerformanceData = [
  { time: '09:00', cpu: 45, memory: 62, latency: 12 },
  { time: '09:05', cpu: 52, memory: 65, latency: 15 },
  { time: '09:10', cpu: 48, memory: 63, latency: 11 },
  { time: '09:15', cpu: 55, memory: 68, latency: 18 },
  { time: '09:20', cpu: 43, memory: 61, latency: 9 },
  { time: '09:25', cpu: 49, memory: 64, latency: 13 },
]

const mockChannelData = [
  { channel: 'Ch1-10', active: 8, quality: 85 },
  { channel: 'Ch11-20', active: 9, quality: 92 },
  { channel: 'Ch21-30', active: 7, quality: 78 },
  { channel: 'Ch31-40', active: 10, quality: 95 },
  { channel: 'Ch41-50', active: 6, quality: 72 },
]

interface StatCardProps {
  title: string
  value: string | number
  change?: string
  icon: React.ElementType
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
  trend?: 'up' | 'down' | 'neutral'
}

function StatCard({ title, value, change, icon: Icon, color, trend = 'neutral' }: StatCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600', 
    yellow: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
  }

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-emerald-400'
      case 'down': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800/50 shadow-2xl p-6 hover:scale-105 transition-transform duration-200 cursor-pointer group"
         style={{
           background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(17, 24, 39, 0.9) 100%)'
         }}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-400 uppercase tracking-wide mb-1">{title}</p>
          <p className="text-3xl font-bold text-white mb-1">{value}</p>
          {change && (
            <p className={`text-xs font-medium ${getTrendColor()}`}>{change}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-r ${colorClasses[color]} shadow-lg group-hover:shadow-xl transition-shadow duration-200`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  )
}

interface StatusIndicatorProps {
  status: 'healthy' | 'warning' | 'error' | 'disconnected'
  label: string
}

function StatusIndicator({ status, label }: StatusIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'healthy':
        return 'text-emerald-400'
      case 'warning':
        return 'text-amber-400'
      case 'error':
        return 'text-red-400'
      case 'disconnected':
        return 'text-gray-400'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />
      case 'error':
        return <AlertTriangle className="h-5 w-5" />
      case 'disconnected':
        return <Clock className="h-5 w-5" />
      default:
        return <Clock className="h-5 w-5" />
    }
  }

  const getBadgeStyle = () => {
    switch (status) {
      case 'healthy':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'warning':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'disconnected':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className={getStatusColor()}>
          {getStatusIcon()}
        </div>
        <span className="text-sm font-medium text-gray-300">{label}</span>
      </div>
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getBadgeStyle()}`}>
        {status}
      </span>
    </div>
  )
}

export default function Dashboard() {
  const queryClient = useQueryClient()

  // Fetch system data
  const { data: systemHealth } = useQuery<SystemHealth>({
    queryKey: ['system-health'],
    queryFn: () => api.system.getStatus(), // Changed from getHealth() to getStatus()
    refetchInterval: 5000,
  })

  const { data: megStatus } = useQuery<MEGConnectionStatus>({
    queryKey: ['meg-status'],
    queryFn: () => api.meg.getStatus(),
    refetchInterval: 2000,
  })

  const { data: metrics } = useQuery<PerformanceMetrics[]>({
    queryKey: ['performance-metrics'],
    queryFn: () => api.system.getMetrics(),
    refetchInterval: 1000,
  })

  // MEG Monitor Data Hook
  const { data: megMonitorDataResult, isLoading: isLoadingMonitorData, error: monitorDataError } = useMEGMonitorData();
  const megMonitorData = megMonitorDataResult?.data;
  const megSamplingRate = megMonitorDataResult?.samplingRate;
  const megChannels = megMonitorDataResult?.channels;
  const { sensorStatus } = useSensorStatus() // Get sensor status

  // Filter channels based on sensorStatus.ACT
  const activeSensorChannels = React.useMemo(() => {
    if (!sensorStatus || !sensorStatus.parsed_sensor_statuses || !megChannels) {
      return Array.from({ length: 192 }, (_, i) => i + 1); // Default to all 192 channels if no status or megChannels
    }
    const activeChannels: number[] = [];
    for (let i = 1; i <= megChannels; i++) { // Iterate from 1 to megChannels for sensor IDs
      const status = sensorStatus.parsed_sensor_statuses[i];
      if (status && status.ACT === 1) {
        activeChannels.push(i);
      }
    }
    return activeChannels;
  }, [sensorStatus, megChannels]);

  const handleToggleStreaming = async () => {
    if (megStatus?.isConnected) {
      await api.meg.disconnect()
    } else {
      const config: MEGConfig = {
        host: megStatus?.host || "192.168.0.10",
        port: megStatus?.port || 8089,
        samplingRate: megStatus?.samplingRate || 375,
        channels: megStatus?.channels || 192,
        timeout: 10000,
      }
      await api.meg.connect(config)
    }
    queryClient.invalidateQueries({ queryKey: ['meg-status'] }) // Re-fetch status after toggle
  }

  return (
    <div className="space-y-8 p-6 bg-gray-900 min-h-screen text-gray-100">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-white mb-3">MEG Dashboard</h1>
        <p className="text-gray-400 text-lg">
          Real-time overview of your MEG system performance and status
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="MEG Channels"
          value={megStatus?.channels || 192}
          change={megStatus?.isConnected ? "Connected" : "Disconnected"}
          icon={Activity}
          color="blue"
        />
        <StatCard
          title="Sampling Rate"
          value={megStatus?.samplingRate ? `${megStatus.samplingRate} Hz` : "N/A"}
          change="Real-time"
          icon={Zap}
          color="green"
        />
        <StatCard
          title="Active Sessions"
          value={1}
          change="+1 from yesterday"
          icon={Brain}
          color="purple"
        />
        <StatCard
          title="System Load"
          value="45%"
          change="Normal"
          icon={Cpu}
          color="yellow"
        />
      </div>

      {/* System Status & MEG Connection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
          <div className="card-header mb-4">
            <h3 className="text-xl font-semibold text-white">System Health</h3>
          </div>
          <div className="card-content space-y-4">
            <StatusIndicator 
              status={systemHealth?.megConnection || 'error'} 
              label="MEG Connection" 
            />
            <StatusIndicator 
              status={systemHealth?.signalProcessing || 'warning'} 
              label="Signal Processing" 
            />
            <StatusIndicator 
              status={systemHealth?.classification || 'healthy'} 
              label="Classification" 
            />
            <StatusIndicator 
              status={systemHealth?.storage || 'healthy'} 
              label="Data Storage" 
            />
            <div className="pt-4 border-t border-gray-700/50">
              <StatusIndicator 
                status={systemHealth?.overall || 'warning'} 
                label="Overall System" 
              />
            </div>
          </div>
        </div>

        <div className="card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
          <div className="card-header mb-4">
            <h3 className="text-xl font-semibold text-white">MEG Connection Details</h3>
          </div>
          <div className="card-content">
            <ConnectionStatus
              isConnected={megStatus?.isConnected || false}
              connectionType={megStatus?.connectionType}
              host={megStatus?.host || "192.168.0.10"}
              port={megStatus?.port || 8089}
              samplingRate={megStatus?.samplingRate}
              channels={megStatus?.channels}
              lastUpdate={megStatus?.lastUpdate}
              throughput={megStatus?.throughput}
              frameRate={megStatus?.frameRate}
              quality={megStatus?.quality}
            />
          </div>
        </div>
      </div>

      {/* Sensor Grid */}
      <div className="card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
        <SensorGrid />
      </div>

      {/* Real-time Signal Visualization */}
      <div className="card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
        <SignalVisualization
          data={megMonitorData}
          samplingRate={megSamplingRate || 0} // Provide default for samplingRate
          channels={activeSensorChannels} // Pass filtered active channels
          isStreaming={megStatus?.isConnected || false}
          onToggleStreaming={handleToggleStreaming}
          height={400}
          title="Real-time MEG Signal Stream"
        />
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
          <div className="card-header mb-4">
            <h3 className="text-xl font-semibold text-white">System Performance</h3>
          </div>
          <div className="card-content">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics || mockPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(17, 24, 39, 0.95)',
                      border: '1px solid rgba(75, 85, 99, 0.5)',
                      borderRadius: '8px',
                      color: '#d1d5db'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cpu" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="CPU %" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="memory" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Memory %" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="latency" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    name="Latency (ms)" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
          <div className="card-header mb-4">
            <h3 className="text-xl font-semibold text-white">Channel Quality</h3>
          </div>
          <div className="card-content">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockChannelData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="channel" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(17, 24, 39, 0.95)',
                      border: '1px solid rgba(75, 85, 99, 0.5)',
                      borderRadius: '8px',
                      color: '#d1d5db'
                    }}
                  />
                  <Bar dataKey="active" fill="#3b82f6" name="Active Channels" />
                  <Bar dataKey="quality" fill="#10b981" name="Quality %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
        <div className="card-header mb-4">
          <h3 className="text-xl font-semibold text-white">Recent Activity</h3>
        </div>
        <div className="card-content">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-200">MEG connection established</p>
                <p className="text-xs text-gray-400">2 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors">
              <div className="flex-shrink-0">
                <Brain className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-200">Training session completed</p>
                <p className="text-xs text-gray-400">15 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors">
              <div className="flex-shrink-0">
                <Database className="h-5 w-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-200">Model saved successfully</p>
                <p className="text-xs text-gray-400">1 hour ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-200">Signal quality warning on channels 45-50</p>
                <p className="text-xs text-gray-400">2 hours ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
