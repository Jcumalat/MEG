import React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Wifi, 
  WifiOff, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Zap,
  Database,
  Play,
  PowerOff,
  Loader2
} from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '../lib/api'
import { MEGConfig } from '../types'

interface ConnectionStatusProps {
  isConnected: boolean
  connectionType?: 'TCP' | 'LSL' | null
  host: string
  port: number
  samplingRate?: number
  channels?: number
  lastUpdate?: string
  throughput?: number
  frameRate?: number
  quality?: 'excellent' | 'good' | 'fair' | 'poor'
  className?: string
}

export default function ConnectionStatus({
  isConnected,
  connectionType,
  host,
  port,
  samplingRate,
  channels,
  lastUpdate,
  throughput,
  frameRate,
  quality = 'good',
  className
}: ConnectionStatusProps) {
  const queryClient = useQueryClient()

  const connectMutation = useMutation({
    mutationFn: (config: MEGConfig) => api.meg.connect(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-status'] })
      console.log('MEG system connected successfully.')
    },
    onError: (error: any) => {
      console.error('Failed to connect to MEG system:', error)
      // Optionally, display an error message to the user
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: () => api.meg.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-status'] })
      console.log('MEG system disconnected successfully.')
    },
    onError: (error: any) => {
      console.error('Failed to disconnect from MEG system:', error)
      // Optionally, display an error message to the user
    },
  })

  const handleConnect = () => {
    const config: MEGConfig = {
      host,
      port,
      samplingRate: samplingRate || 375, // Use prop or default
      channels: channels || 192,         // Use prop or default
      timeout: 10000,
    }
    connectMutation.mutate(config)
  }

  const handleDisconnect = () => {
    disconnectMutation.mutate()
  }

  const getStatusColor = () => {
    if (!isConnected) return 'text-red-500 bg-red-50 border-red-200'
    switch (quality) {
      case 'excellent': return 'text-green-500 bg-green-50 border-green-200'
      case 'good': return 'text-blue-500 bg-blue-50 border-blue-200'
      case 'fair': return 'text-yellow-500 bg-yellow-50 border-yellow-200'
      case 'poor': return 'text-red-500 bg-red-50 border-red-200'
      default: return 'text-gray-500 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = () => {
    if (!isConnected) return <WifiOff className="h-5 w-5" />
    switch (quality) {
      case 'excellent': return <CheckCircle className="h-5 w-5" />
      case 'good': return <Wifi className="h-5 w-5" />
      case 'fair': return <AlertTriangle className="h-5 w-5" />
      case 'poor': return <AlertTriangle className="h-5 w-5" />
      default: return <Clock className="h-5 w-5" />
    }
  }

  const getQualityBadge = () => {
    if (!isConnected) return null
    
    const badgeColors = {
      excellent: 'bg-green-100 text-green-800',
      good: 'bg-blue-100 text-blue-800',
      fair: 'bg-yellow-100 text-yellow-800',
      poor: 'bg-red-100 text-red-800'
    }

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeColors[quality]}`}>
        {quality}
      </span>
    )
  }

  return (
    <div className={clsx(
      'rounded-lg border p-4 transition-all duration-200',
      getStatusColor(),
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <h3 className="font-semibold">
            MEG Connection
          </h3>
        </div>
        {getQualityBadge()}
      </div>

      {/* Connection Details */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm opacity-75">Status</span>
          <span className="text-sm font-medium">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {isConnected && (
          <>
            {connectionType && (
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-75">Type</span>
                <span className="text-sm font-medium">{connectionType}</span>
              </div>
            )}

            {host && port && (
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-75">Endpoint</span>
                <span className="text-sm font-medium font-mono">{host}:{port}</span>
              </div>
            )}

            {samplingRate && (
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-75">Sampling Rate</span>
                <div className="flex items-center space-x-1">
                  <Zap className="h-3 w-3" />
                  <span className="text-sm font-medium">{samplingRate} Hz</span>
                </div>
              </div>
            )}

            {channels && (
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-75">Channels</span>
                <div className="flex items-center space-x-1">
                  <Activity className="h-3 w-3" />
                  <span className="text-sm font-medium">{channels}</span>
                </div>
              </div>
            )}

            {frameRate && (
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-75">Frame Rate</span>
                <span className="text-sm font-medium">{frameRate.toFixed(1)} FPS</span>
                </div>
            )}

            {throughput && (
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-75">Throughput</span>
                <div className="flex items-center space-x-1">
                  <Database className="h-3 w-3" />
                  <span className="text-sm font-medium">{throughput.toFixed(1)} Mbps</span>
                </div>
              </div>
            )}

            {lastUpdate && (
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-75">Last Update</span>
                <span className="text-sm font-medium">
                  {new Date(lastUpdate).toLocaleTimeString()}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Connection Indicator and Buttons */}
      <div className="mt-3 pt-3 border-t border-current border-opacity-20 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={clsx(
            'w-2 h-2 rounded-full',
            isConnected ? 'bg-current animate-pulse' : 'bg-current opacity-50'
          )} />
          <span className="text-xs opacity-75">
            {isConnected ? 'Live data stream' : 'No connection'}
          </span>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleConnect}
            disabled={isConnected || connectMutation.isPending}
            className="flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {connectMutation.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Play className="h-3 w-3 mr-1" />
            )}
            Connect
          </button>
          <button
            onClick={handleDisconnect}
            disabled={!isConnected || disconnectMutation.isPending}
            className="flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {disconnectMutation.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <PowerOff className="h-3 w-3 mr-1" />
            )}
            Disconnect
          </button>
        </div>
      </div>
    </div>
  )
}
