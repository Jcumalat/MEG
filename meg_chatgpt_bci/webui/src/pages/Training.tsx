import React, { useState } from 'react'
import { 
  Play, 
  Pause, 
  Square, 
  Brain, 
  Clock, 
  Target, 
  CheckCircle,
  AlertCircle,
  Settings,
  Save,
  Download,
  Loader2
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { TrainingSession, TrainingConfig, TrainingTrial } from '../types'
import toast from 'react-hot-toast'
import { clsx } from 'clsx' // Import clsx

const defaultConfig: TrainingConfig = {
  trialsPerDirection: 10,
  trialDuration: 4,
  restDuration: 2,
  cueDuration: 1,
  directions: ['up', 'down', 'left', 'right'],
  conditions: ['imagined']
}

interface TrialIndicatorProps {
  trial: TrainingTrial
  isActive: boolean
}

function TrialIndicator({ trial, isActive }: TrialIndicatorProps) {
  const getStatusColor = () => {
    if (isActive) return 'bg-blue-500'
    switch (trial.quality) {
      case 'good': return 'bg-green-500'
      case 'fair': return 'bg-yellow-500'
      case 'poor': return 'bg-red-500'
      default: return 'bg-gray-300'
    }
  }

  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${getStatusColor()}`}>
      {trial.direction.charAt(0).toUpperCase()}
    </div>
  )
}

export default function Training() {
  const [config, setConfig] = useState<TrainingConfig>(defaultConfig)
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const queryClient = useQueryClient()

  // Fetch training sessions
  const { data: sessions = [] } = useQuery<TrainingSession[]>({
    queryKey: ['training-sessions'],
    queryFn: () => api.training.getSessions(),
    refetchInterval: 2000,
  })

  // Fetch active session details
  const { data: currentSession } = useQuery<TrainingSession>({
    queryKey: ['training-session', activeSession],
    queryFn: () => api.training.getSession(activeSession!),
    enabled: !!activeSession,
    refetchInterval: 1000,
  })

  // Fetch trials for active session
  const { data: trials = [] } = useQuery<TrainingTrial[]>({
    queryKey: ['training-trials', activeSession],
    queryFn: () => api.training.getTrials(activeSession!),
    enabled: !!activeSession,
    refetchInterval: 1000,
  })

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (config: TrainingConfig) => api.training.createSession(config),
    onSuccess: (session) => {
      setActiveSession(session.id)
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] })
      toast.success('Training session created successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to create session: ${error.message}`)
    }
  })

  // Start session mutation
  const startSessionMutation = useMutation({
    mutationFn: (sessionId: string) => api.training.startSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-session', activeSession] })
      toast.success('Training session started')
    },
    onError: (error: Error) => {
      toast.error(`Failed to start session: ${error.message}`)
    }
  })

  // Stop session mutation
  const stopSessionMutation = useMutation({
    mutationFn: (sessionId: string) => api.training.stopSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-session', activeSession] })
      toast.success('Training session stopped')
    },
    onError: (error: Error) => {
      toast.error(`Failed to stop session: ${error.message}`)
    }
  })

  const handleCreateSession = () => {
    createSessionMutation.mutate(config)
  }

  const handleStartSession = () => {
    if (activeSession) {
      startSessionMutation.mutate(activeSession)
    }
  }

  const handleStopSession = () => {
    if (activeSession) {
      stopSessionMutation.mutate(activeSession)
    }
  }

  const getProgressPercentage = () => {
    if (!currentSession) return 0
    return (currentSession.trialsCompleted / currentSession.totalTrials) * 100
  }

  return (
    <div className="space-y-8 p-6 bg-gray-950 min-h-screen text-gray-100">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-white mb-3">Training Sessions</h1>
        <p className="text-gray-400 text-lg">
          Configure and manage your MEG BCI training sessions
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center px-4 py-2 border border-gray-700 text-sm font-medium rounded-md shadow-sm text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
        >
          <Settings className="h-4 w-4 mr-2" />
          Configure
        </button>
        <button
          onClick={handleCreateSession}
          disabled={createSessionMutation.isPending}
          className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {createSessionMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Brain className="h-4 w-4 mr-2" />
          )}
          New Session
        </button>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <div className="card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
          <div className="card-header mb-4">
            <h3 className="text-xl font-semibold text-white">Training Configuration</h3>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Trials per Direction</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={config.trialsPerDirection}
                  onChange={(e) => setConfig({
                    ...config,
                    trialsPerDirection: parseInt(e.target.value)
                  })}
                  min="1"
                  max="50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Trial Duration (s)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={config.trialDuration}
                  onChange={(e) => setConfig({
                    ...config,
                    trialDuration: parseInt(e.target.value)
                  })}
                  min="1"
                  max="10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Rest Duration (s)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={config.restDuration}
                  onChange={(e) => setConfig({
                    ...config,
                    restDuration: parseInt(e.target.value)
                  })}
                  min="1"
                  max="10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Cue Duration (s)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={config.cueDuration}
                  onChange={(e) => setConfig({
                    ...config,
                    cueDuration: parseInt(e.target.value)
                  })}
                  min="0.5"
                  max="5"
                  step="0.5"
                />
              </div>
            </div>
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Directions</label>
              <div className="flex flex-wrap gap-3">
                {['up', 'down', 'left', 'right', 'rest'].map((direction) => (
                  <label key={direction} className="flex items-center text-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.directions.includes(direction)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setConfig({
                            ...config,
                            directions: [...config.directions, direction]
                          })
                        } else {
                          setConfig({
                            ...config,
                            directions: config.directions.filter(d => d !== direction)
                          })
                        }
                      }}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-600 rounded"
                    />
                    <span className="ml-2 text-sm capitalize">{direction}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Session */}
      {currentSession && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Session Control */}
          <div className="lg:col-span-1 card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
            <div className="card-header mb-4">
              <h3 className="text-xl font-semibold text-white">Session Control</h3>
            </div>
            <div className="card-content space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Status</span>
                <span className={clsx(
                  "px-2 py-1 rounded-full text-xs font-medium",
                  currentSession.status === 'active' && 'bg-blue-500/20 text-blue-400',
                  currentSession.status === 'completed' && 'bg-emerald-500/20 text-emerald-400',
                  currentSession.status === 'failed' && 'bg-red-500/20 text-red-400'
                )}>
                  {currentSession.status}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Progress</span>
                <span className="text-sm font-medium text-gray-100">
                  {currentSession.trialsCompleted} / {currentSession.totalTrials}
                </span>
              </div>

              <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div 
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>

              <div className="flex space-x-2 pt-2">
                {currentSession.status === 'active' ? (
                  <button
                    onClick={handleStopSession}
                    disabled={stopSessionMutation.isPending}
                    className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {stopSessionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Square className="h-4 w-4 mr-2" />
                    )}
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={handleStartSession}
                    disabled={startSessionMutation.isPending || currentSession.status === 'completed'}
                    className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {startSessionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Start
                  </button>
                )}
              </div>

              <div className="pt-4 border-t border-gray-700/50">
                <div className="text-sm text-gray-400 space-y-1">
                  <div>Started: {new Date(currentSession.startTime).toLocaleString()}</div>
                  {currentSession.endTime && (
                    <div>Ended: {new Date(currentSession.endTime).toLocaleString()}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Trial Progress */}
          <div className="lg:col-span-2 card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
            <div className="card-header mb-4">
              <h3 className="text-xl font-semibold text-white">Trial Progress</h3>
            </div>
            <div className="card-content">
              <div className="grid grid-cols-10 gap-2">
                {trials.map((trial, index) => (
                  <TrialIndicator
                    key={trial.id}
                    trial={trial}
                    isActive={currentSession.status === 'active' && index === currentSession.trialsCompleted}
                  />
                ))}
                {/* Placeholder for remaining trials */}
                {Array.from({ length: currentSession.totalTrials - trials.length }).map((_, index) => (
                  <div
                    key={`placeholder-${index}`}
                    className="w-8 h-8 rounded-full bg-gray-700 border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500"
                  >
                    {index + trials.length + 1}
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex flex-wrap items-center space-x-4 text-sm text-gray-300">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-2" />
                  <span>Good Quality</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2" />
                  <span>Fair Quality</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 mr-2" />
                  <span>Poor Quality</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
                  <span>Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session History */}
      <div className="card bg-gray-800/50 border border-gray-700/50 rounded-xl shadow-lg p-6">
        <div className="card-header mb-4">
          <h3 className="text-xl font-semibold text-white">Training Sessions History</h3>
        </div>
        <div className="card-content">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Brain className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-lg font-medium">No training sessions yet</p>
              <p className="text-sm">Create your first session to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Session
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Started
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {sessions.map((session) => (
                    <tr key={session.id} className={clsx(
                      "hover:bg-gray-700 transition-colors duration-150",
                      session.id === activeSession && 'bg-indigo-900/30'
                    )}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-100">{session.name}</div>
                        <div className="text-sm text-gray-400">
                          {session.directions.join(', ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={clsx(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          session.status === 'active' && 'bg-blue-500/20 text-blue-400',
                          session.status === 'completed' && 'bg-emerald-500/20 text-emerald-400',
                          session.status === 'failed' && 'bg-red-500/20 text-red-400'
                        )}>
                          {session.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">
                        {session.trialsCompleted} / {session.totalTrials}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {new Date(session.startTime).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setActiveSession(session.id)}
                          className="text-indigo-400 hover:text-indigo-300 mr-3"
                        >
                          View
                        </button>
                        {session.status === 'completed' && (
                          <button className="text-emerald-400 hover:text-emerald-300">
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
