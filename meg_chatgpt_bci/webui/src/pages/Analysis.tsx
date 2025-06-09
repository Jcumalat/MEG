import React, { useState } from 'react'
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  Download, 
  Filter, 
  Calendar,
  TrendingUp,
  Activity,
  Brain,
  Eye,
  Settings
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  Pie
} from 'recharts'
import { api } from '../lib/api'
import { SpectralAnalysis, ChannelAnalysis, TrainingSession } from '../types'

// Mock data for demonstration
const mockSpectralData = [
  { frequency: 1, power: 0.8, band: 'delta' },
  { frequency: 4, power: 1.2, band: 'theta' },
  { frequency: 8, power: 2.1, band: 'alpha' },
  { frequency: 12, power: 1.8, band: 'alpha' },
  { frequency: 15, power: 1.5, band: 'beta' },
  { frequency: 20, power: 1.3, band: 'beta' },
  { frequency: 30, power: 0.9, band: 'beta' },
  { frequency: 40, power: 0.6, band: 'gamma' },
  { frequency: 60, power: 2.5, band: 'noise' }, // 60Hz power line
]

const mockBandPowers = [
  { name: 'Delta (1-4 Hz)', value: 15, color: '#8884d8' },
  { name: 'Theta (4-8 Hz)', value: 20, color: '#82ca9d' },
  { name: 'Alpha (8-12 Hz)', value: 35, color: '#ffc658' },
  { name: 'Beta (12-30 Hz)', value: 25, color: '#ff7300' },
  { name: 'Gamma (30+ Hz)', value: 5, color: '#8dd1e1' },
]

const mockClassificationAccuracy = [
  { session: 'Session 1', accuracy: 72, trials: 40 },
  { session: 'Session 2', accuracy: 78, trials: 40 },
  { session: 'Session 3', accuracy: 85, trials: 40 },
  { session: 'Session 4', accuracy: 82, trials: 40 },
  { session: 'Session 5', accuracy: 88, trials: 40 },
]

interface AnalysisCardProps {
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
}

function AnalysisCard({ title, children, actions }: AnalysisCardProps) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          {actions && <div className="flex space-x-2">{actions}</div>}
        </div>
      </div>
      <div className="card-content">
        {children}
      </div>
    </div>
  )
}

export default function Analysis() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h')
  const [selectedChannels, setSelectedChannels] = useState<number[]>([])
  const [analysisType, setAnalysisType] = useState<'spectral' | 'classification' | 'channels'>('spectral')

  // Fetch analysis data
  const { data: spectralAnalysis } = useQuery<SpectralAnalysis>({
    queryKey: ['spectral-analysis', selectedTimeRange],
    queryFn: () => api.analysis.getSpectralAnalysis({ timeRange: selectedTimeRange }),
    refetchInterval: 30000,
  })

  const { data: channels = [] } = useQuery<ChannelAnalysis[]>({
    queryKey: ['channel-analysis'],
    queryFn: () => api.analysis.getChannels(),
    refetchInterval: 10000,
  })

  const { data: sessions = [] } = useQuery<TrainingSession[]>({
    queryKey: ['training-sessions'],
    queryFn: () => api.training.getSessions(),
  })

  const handleExportData = () => {
    const exportData = {
      spectral: spectralAnalysis || mockSpectralData,
      channels: channels,
      sessions: sessions,
      timestamp: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meg_analysis_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const activeChannels = channels.filter(ch => ch.isActive)
  const channelQualityDistribution = {
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
          <h1 className="text-2xl font-bold text-gray-900">Data Analysis</h1>
          <p className="text-gray-600">
            Analyze MEG signals, training performance, and system metrics
          </p>
        </div>
        <div className="flex space-x-3">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="input"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={handleExportData}
            className="btn-secondary"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </button>
        </div>
      </div>

      {/* Analysis Type Selector */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setAnalysisType('spectral')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            analysisType === 'spectral'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Activity className="h-4 w-4 mr-2 inline" />
          Spectral Analysis
        </button>
        <button
          onClick={() => setAnalysisType('classification')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            analysisType === 'classification'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Brain className="h-4 w-4 mr-2 inline" />
          Classification Performance
        </button>
        <button
          onClick={() => setAnalysisType('channels')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            analysisType === 'channels'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Eye className="h-4 w-4 mr-2 inline" />
          Channel Analysis
        </button>
      </div>

      {/* Spectral Analysis */}
      {analysisType === 'spectral' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnalysisCard title="Power Spectral Density">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={spectralAnalysis?.powerSpectrum ? 
                  spectralAnalysis.frequencies.map((freq, i) => ({
                    frequency: freq,
                    power: spectralAnalysis.powerSpectrum[i]
                  })) : mockSpectralData
                }>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="frequency" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="power" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </AnalysisCard>

          <AnalysisCard title="Frequency Band Distribution">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={mockBandPowers}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {mockBandPowers.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </AnalysisCard>

          <AnalysisCard title="Band Power Analysis">
            <div className="space-y-4">
              {spectralAnalysis?.bands ? Object.entries(spectralAnalysis.bands).map(([band, power]) => (
                <div key={band} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{band}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.min(power * 10, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-16 text-right">
                      {power.toFixed(2)} μV²
                    </span>
                  </div>
                </div>
              )) : mockBandPowers.map((band) => (
                <div key={band.name} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{band.name}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full"
                        style={{ 
                          width: `${band.value}%`,
                          backgroundColor: band.color
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">
                      {band.value}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </AnalysisCard>

          <AnalysisCard title="Peak Frequency Analysis">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {spectralAnalysis?.peakFrequency?.toFixed(1) || '10.2'} Hz
                  </div>
                  <div className="text-sm text-gray-500">Peak Frequency</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {spectralAnalysis?.bandwidth?.toFixed(1) || '2.5'} Hz
                  </div>
                  <div className="text-sm text-gray-500">Bandwidth</div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Frequency Characteristics</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div>• Dominant rhythm in alpha band (8-12 Hz)</div>
                  <div>• Strong 60Hz power line interference detected</div>
                  <div>• Beta activity present during motor tasks</div>
                  <div>• Low gamma activity baseline</div>
                </div>
              </div>
            </div>
          </AnalysisCard>
        </div>
      )}

      {/* Classification Performance */}
      {analysisType === 'classification' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnalysisCard title="Training Session Accuracy">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={mockClassificationAccuracy}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="session" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => [`${value}%`, 'Accuracy']} />
                  <Bar dataKey="accuracy" fill="#3b82f6" />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </AnalysisCard>

          <AnalysisCard title="Performance Metrics">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">85.2%</div>
                  <div className="text-sm text-gray-500">Average Accuracy</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">200</div>
                  <div className="text-sm text-gray-500">Total Trials</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Up Movement</span>
                    <span>88%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '88%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Down Movement</span>
                    <span>82%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '82%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Left Movement</span>
                    <span>86%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '86%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Right Movement</span>
                    <span>84%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: '84%' }} />
                  </div>
                </div>
              </div>
            </div>
          </AnalysisCard>

          <AnalysisCard title="Learning Curve">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={mockClassificationAccuracy}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="session" />
                  <YAxis domain={[60, 100]} />
                  <Tooltip formatter={(value) => [`${value}%`, 'Accuracy']} />
                  <Line 
                    type="monotone" 
                    dataKey="accuracy" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </AnalysisCard>

          <AnalysisCard title="Model Performance Summary">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-blue-600">LDA</div>
                  <div className="text-sm text-gray-500">85.2%</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-600">SVM</div>
                  <div className="text-sm text-gray-500">87.1%</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-purple-600">RF</div>
                  <div className="text-sm text-gray-500">83.8%</div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Best Model: SVM</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div>• Precision: 87.5%</div>
                  <div>• Recall: 86.8%</div>
                  <div>• F1-Score: 87.1%</div>
                  <div>• Training Time: 2.3s</div>
                  <div>• Inference Time: 12ms</div>
                </div>
              </div>
            </div>
          </AnalysisCard>
        </div>
      )}

      {/* Channel Analysis */}
      {analysisType === 'channels' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnalysisCard title="Channel Quality Distribution">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={[
                  { quality: 'Excellent', count: channelQualityDistribution.excellent, color: '#10b981' },
                  { quality: 'Good', count: channelQualityDistribution.good, color: '#3b82f6' },
                  { quality: 'Fair', count: channelQualityDistribution.fair, color: '#f59e0b' },
                  { quality: 'Poor', count: channelQualityDistribution.poor, color: '#ef4444' },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="quality" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </AnalysisCard>

          <AnalysisCard title="SNR Distribution">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={channels.slice(0, 50).map((ch, i) => ({
                  channel: i + 1,
                  snr: ch.snr
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="channel" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value} dB`, 'SNR']} />
                  <Line 
                    type="monotone" 
                    dataKey="snr" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={false}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </AnalysisCard>

          <AnalysisCard title="Channel Statistics">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{activeChannels.length}</div>
                  <div className="text-sm text-gray-500">Active Channels</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {activeChannels.length > 0 ? (activeChannels.reduce((sum, ch) => sum + ch.snr, 0) / activeChannels.length).toFixed(1) : '0'}
                  </div>
                  <div className="text-sm text-gray-500">Avg SNR (dB)</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Excellent Quality</span>
                    <span>{channelQualityDistribution.excellent}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${(channelQualityDistribution.excellent / channels.length) * 100}%` }} 
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Good Quality</span>
                    <span>{channelQualityDistribution.good}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${(channelQualityDistribution.good / channels.length) * 100}%` }} 
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Fair Quality</span>
                    <span>{channelQualityDistribution.fair}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-600 h-2 rounded-full" 
                      style={{ width: `${(channelQualityDistribution.fair / channels.length) * 100}%` }} 
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Poor Quality</span>
                    <span>{channelQualityDistribution.poor}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-600 h-2 rounded-full" 
                      style={{ width: `${(channelQualityDistribution.poor / channels.length) * 100}%` }} 
                    />
                  </div>
                </div>
              </div>
            </div>
          </AnalysisCard>

          <AnalysisCard title="Top Performing Channels">
            <div className="space-y-3">
              {channels
                .sort((a, b) => b.snr - a.snr)
                .slice(0, 10)
                .map((channel, index) => (
                  <div key={channel.channelId} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-sm font-medium text-gray-900">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="text-sm font-medium">Channel {channel.channelId}</div>
                        <div className="text-xs text-gray-500 capitalize">
                          {channel.signalQuality} quality
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{channel.snr.toFixed(1)} dB</div>
                      <div className="text-xs text-gray-500">
                        {new Date(channel.lastUpdate).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </AnalysisCard>
        </div>
      )}
    </div>
  )
}
