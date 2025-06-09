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
  Download
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { TrainingSession, TrainingConfig, TrainingTrial } from '../types'
import toast from 'react-hot-toast'

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training</h1>
          <p className="text-gray-600">
            Train the BCI system to recognize your movement intentions
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="btn-secondary"
          >
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </button>
          <button
            onClick={handleCreateSession}
            disabled={createSessionMutation.isPending}
            className="btn-primary"
          >
            <Brain className="h-4 w-4 mr-2" />
            New Session
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Training Configuration</h3>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label">Trials per Direction</label>
                <input
                  type="number"
                  className="input"
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
                <label className="label">Trial Duration (s)</label>
                <input
                  type="number"
                  className="input"
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
                <label className="label">Rest Duration (s)</label>
                <input
                  type="number"
                  className="input"
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
                <label className="label">Cue Duration (s)</label>
                <input
                  type="number"
                  className="input"
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
            <div className="mt-4">
              <label className="label">Directions</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {['up', 'down', 'left', 'right', 'rest'].map((direction) => (
                  <label key={direction} className="flex items-center">
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
                      className="mr-2"
                    />
                    <span className="text-sm capitalize">{direction}</span>
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
          <div className="lg:col-span-1">
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Session Control</h3>
              </div>
              <div className="card-content space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className={`status-indicator ${
                    currentSession.status === 'active' ? 'status-processing' :
                    currentSession.status === 'completed' ? 'status-connected' :
                    'status-disconnected'
                  }`}>
                    {currentSession.status}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Progress</span>
                  <span className="text-sm font-medium text-gray-900">
                    {currentSession.trialsCompleted} / {currentSession.totalTrials}
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                </div>

                <div className="flex space-x-2">
                  {currentSession.status === 'active' ? (
                    <button
                      onClick={handleStopSession}
                      disabled={stopSessionMutation.isPending}
                      className="btn-error flex-1"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={handleStartSession}
                      disabled={startSessionMutation.isPending}
                      className="btn-success flex-1"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start
                    </button>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-500 space-y-1">
                    <div>Started: {new Date(currentSession.startTime).toLocaleString()}</div>
                    {currentSession.endTime && (
                      <div>Ended: {new Date(currentSession.endTime).toLocaleString()}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trial Progress */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Trial Progress</h3>
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
                      className="w-8 h-8 rounded-full bg-gray-200 border-2 border-dashed border-gray-300"
                    />
                  ))}
                </div>
                
                <div className="mt-4 flex items-center space-x-4 text-sm">
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
        </div>
      )}

      {/* Session History */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Training Sessions</h3>
        </div>
        <div className="card-content">
          {sessions.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No training sessions yet</p>
              <p className="text-sm text-gray-400">Create your first session to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Session
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Started
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sessions.map((session) => (
                    <tr key={session.id} className={session.id === activeSession ? 'bg-blue-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{session.name}</div>
                        <div className="text-sm text-gray-500">
                          {session.directions.join(', ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`status-indicator ${
                          session.status === 'active' ? 'status-processing' :
                          session.status === 'completed' ? 'status-connected' :
                          'status-disconnected'
                        }`}>
                          {session.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {session.trialsCompleted} / {session.totalTrials}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(session.startTime).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setActiveSession(session.id)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          View
                        </button>
                        {session.status === 'completed' && (
                          <button className="text-green-600 hover:text-green-900">
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
