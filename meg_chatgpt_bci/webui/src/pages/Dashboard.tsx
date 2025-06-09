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
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { api } from '../lib/api'
import { SystemHealth, PerformanceMetrics, MEGConnectionStatus } from '../types'
import ConnectionStatus from '../components/ConnectionStatus'
import SignalVisualization from '../components/SignalVisualization'

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
}

function StatCard({ title, value, change, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500', 
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
  }

  return (
    <div className="card">
      <div className="card-content">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="ml-4 flex-1">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
            {change && (
              <p className="text-sm text-gray-600">{change}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface StatusIndicatorProps {
  status: 'healthy' | 'warning' | 'error'
  label: string
}

function StatusIndicator({ status, label }: StatusIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'healthy':
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
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
      default:
        return <Clock className="h-5 w-5" />
    }
  }

  return (
    <div className="flex items-center space-x-2">
      <div className={getStatusColor()}>
        {getStatusIcon()}
      </div>
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <span className={`text-sm capitalize ${getStatusColor()}`}>
        {status}
      </span>
    </div>
  )
}

export default function Dashboard() {
  // Fetch system data
  const { data: systemHealth } = useQuery<SystemHealth>({
    queryKey: ['system-health'],
    queryFn: () => api.system.getHealth(),
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Dashboard</h1>
        <p className="text-gray-600">
          Real-time overview of your MEG BCI system performance and status
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

      {/* System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">System Health</h3>
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
            <div className="pt-4 border-t border-gray-200">
              <StatusIndicator 
                status={systemHealth?.overall || 'warning'} 
                label="Overall System" 
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">MEG Connection</h3>
          </div>
          <div className="card-content space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Status</span>
              <span className={`text-sm font-medium ${
                megStatus?.isConnected ? 'text-green-600' : 'text-red-600'
              }`}>
                {megStatus?.isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Connection Type</span>
              <span className="text-sm font-medium text-gray-900">
                {megStatus?.connectionType || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Host</span>
              <span className="text-sm font-medium text-gray-900">
                {megStatus?.host || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Port</span>
              <span className="text-sm font-medium text-gray-900">
                {megStatus?.port || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Last Update</span>
              <span className="text-sm font-medium text-gray-900">
                {megStatus?.lastUpdate ? new Date(megStatus.lastUpdate).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">System Performance</h3>
          </div>
          <div className="card-content">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics || mockPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
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

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Channel Quality</h3>
          </div>
          <div className="card-content">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockChannelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="channel" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="active" fill="#3b82f6" name="Active Channels" />
                  <Bar dataKey="quality" fill="#10b981" name="Quality %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
        </div>
        <div className="card-content">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">MEG connection established</p>
                <p className="text-xs text-gray-500">2 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <Brain className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">Training session completed</p>
                <p className="text-xs text-gray-500">15 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <Database className="h-5 w-5 text-purple-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">Model saved successfully</p>
                <p className="text-xs text-gray-500">1 hour ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">Signal quality warning on channels 45-50</p>
                <p className="text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
