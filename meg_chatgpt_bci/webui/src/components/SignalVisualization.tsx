import React, { useEffect, useRef, useState } from 'react'
import { Activity, Pause, Play, Settings, Download, Maximize2 } from 'lucide-react'
import { clsx } from 'clsx'

interface SignalVisualizationProps {
  data?: number[][]
  channels?: number[]
  samplingRate?: number
  isStreaming?: boolean
  onToggleStreaming?: () => void
  className?: string
  height?: number
  showControls?: boolean
  title?: string
}

interface ChannelConfig {
  visible: boolean
  color: string
  scale: number
  offset: number
}

const defaultColors = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
]

export default function SignalVisualization({
  data,
  channels = [0, 1, 2, 3],
  samplingRate = 375,
  isStreaming = false,
  onToggleStreaming,
  className,
  height = 400,
  showControls = true,
  title = "Real-time MEG Signal"
}: SignalVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const [channelConfigs, setChannelConfigs] = useState<Record<number, ChannelConfig>>({})
  const [timeWindow, setTimeWindow] = useState(5) // seconds
  const [amplitude, setAmplitude] = useState(100)
  const [showSettings, setShowSettings] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Initialize channel configurations
  useEffect(() => {
    const configs: Record<number, ChannelConfig> = {}
    channels.forEach((channel, index) => {
      configs[channel] = {
        visible: true,
        color: defaultColors[index % defaultColors.length],
        scale: 1.0,
        offset: index * 50
      }
    })
    setChannelConfigs(configs)
  }, [channels])

  // Animation loop for real-time rendering
  useEffect(() => {
    if (!isStreaming || !data || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const animate = () => {
      drawSignal(ctx, canvas.width, canvas.height)
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isStreaming, data, channelConfigs, timeWindow, amplitude])

  const drawSignal = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Clear canvas
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(0, 0, width, height)

    if (!data || data.length === 0) {
      // Draw "No Signal" message
      ctx.fillStyle = '#6b7280'
      ctx.font = '16px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No Signal Data', width / 2, height / 2)
      return
    }

    const samplesPerWindow = timeWindow * samplingRate
    const visibleChannels = channels.filter(ch => channelConfigs[ch]?.visible)
    const channelHeight = height / Math.max(visibleChannels.length, 1)

    // Draw grid
    drawGrid(ctx, width, height, visibleChannels.length)

    // Draw signals
    visibleChannels.forEach((channelIndex, displayIndex) => {
      const config = channelConfigs[channelIndex]
      if (!config) return

      const channelData = data.map(sample => sample[channelIndex] || 0)
      const startSample = Math.max(0, channelData.length - samplesPerWindow)
      const visibleData = channelData.slice(startSample)

      if (visibleData.length < 2) return

      const centerY = (displayIndex + 0.5) * channelHeight
      const scaleY = (channelHeight * 0.4) / amplitude * config.scale

      ctx.strokeStyle = config.color
      ctx.lineWidth = 1.5
      ctx.beginPath()

      visibleData.forEach((value, index) => {
        const x = (index / visibleData.length) * width
        const y = centerY - (value * scaleY) + config.offset

        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })

      ctx.stroke()

      // Draw channel label
      ctx.fillStyle = config.color
      ctx.font = '12px Inter, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`Ch ${channelIndex}`, 8, centerY - channelHeight * 0.3)
    })

    // Draw time axis
    drawTimeAxis(ctx, width, height, timeWindow)
  }

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, channelCount: number) => {
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 0.5

    // Horizontal lines (channel separators)
    for (let i = 1; i < channelCount; i++) {
      const y = (i / channelCount) * height
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Vertical lines (time grid)
    const timeSteps = 10
    for (let i = 1; i < timeSteps; i++) {
      const x = (i / timeSteps) * width
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
  }

  const drawTimeAxis = (ctx: CanvasRenderingContext2D, width: number, height: number, timeWindow: number) => {
    ctx.fillStyle = '#9ca3af'
    ctx.font = '10px Inter, sans-serif'
    ctx.textAlign = 'center'

    const timeSteps = 5
    for (let i = 0; i <= timeSteps; i++) {
      const x = (i / timeSteps) * width
      const timeValue = (timeWindow * i / timeSteps).toFixed(1)
      ctx.fillText(`${timeValue}s`, x, height - 5)
    }
  }

  const toggleChannelVisibility = (channelIndex: number) => {
    setChannelConfigs(prev => ({
      ...prev,
      [channelIndex]: {
        ...prev[channelIndex],
        visible: !prev[channelIndex]?.visible
      }
    }))
  }

  const updateChannelScale = (channelIndex: number, scale: number) => {
    setChannelConfigs(prev => ({
      ...prev,
      [channelIndex]: {
        ...prev[channelIndex],
        scale
      }
    }))
  }

  const exportSignalData = () => {
    if (!data) return

    const csvContent = data.map(sample => sample.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meg_signal_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 shadow-sm', className)}>
      {/* Header */}
      {showControls && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            {isStreaming && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-green-600">Live</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
            >
              <Settings className="h-4 w-4" />
            </button>
            
            <button
              onClick={exportSignalData}
              disabled={!data || data.length === 0}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
            >
              <Maximize2 className="h-4 w-4" />
            </button>

            {onToggleStreaming && (
              <button
                onClick={onToggleStreaming}
                className={clsx(
                  'flex items-center space-x-1 px-3 py-1 rounded-md text-sm font-medium',
                  isStreaming
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                )}
              >
                {isStreaming ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span>{isStreaming ? 'Stop' : 'Start'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Window (seconds)
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={timeWindow}
                onChange={(e) => setTimeWindow(parseInt(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-500">{timeWindow}s</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amplitude Scale
              </label>
              <input
                type="range"
                min="10"
                max="1000"
                value={amplitude}
                onChange={(e) => setAmplitude(parseInt(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-500">{amplitude}</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Visible Channels
              </label>
              <div className="flex flex-wrap gap-1">
                {channels.map(channelIndex => (
                  <button
                    key={channelIndex}
                    onClick={() => toggleChannelVisibility(channelIndex)}
                    className={clsx(
                      'px-2 py-1 text-xs rounded-md border',
                      channelConfigs[channelIndex]?.visible
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    )}
                    style={{
                      backgroundColor: channelConfigs[channelIndex]?.visible 
                        ? channelConfigs[channelIndex]?.color + '20'
                        : undefined,
                      borderColor: channelConfigs[channelIndex]?.visible 
                        ? channelConfigs[channelIndex]?.color
                        : undefined
                    }}
                  >
                    Ch {channelIndex}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className={clsx('relative', isFullscreen && 'fixed inset-0 z-50 bg-white')}>
        <canvas
          ref={canvasRef}
          width={800}
          height={isFullscreen ? window.innerHeight - 100 : height}
          className="w-full h-full"
          style={{ height: isFullscreen ? window.innerHeight - 100 : height }}
        />
        
        {/* Signal Quality Indicator */}
        {data && data.length > 0 && (
          <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
            {data.length} samples • {samplingRate} Hz
          </div>
        )}
      </div>

      {/* Channel Legend */}
      {!showSettings && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-3">
            {channels.filter(ch => channelConfigs[ch]?.visible).map(channelIndex => (
              <div key={channelIndex} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: channelConfigs[channelIndex]?.color }}
                />
                <span className="text-sm text-gray-600">Channel {channelIndex}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
