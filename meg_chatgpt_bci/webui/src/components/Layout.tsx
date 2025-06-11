import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Brain, 
  Activity, 
  Settings, 
  BarChart3, 
  Monitor, 
  Menu, 
  X,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  Zap
} from 'lucide-react'
import { clsx } from 'clsx'
import { useSystemStatus } from '../hooks/useSystemStatus'

interface LayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Noise Reduction', href: '/noise-reduction', icon: Zap }, // New navigation item
  { name: 'Training', href: '/training', icon: Brain },
  { name: 'Monitoring', href: '/monitoring', icon: Monitor },
  { name: 'Analysis', href: '/analysis', icon: Activity },
  { name: 'Configuration', href: '/configuration', icon: Settings },
]

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { data: systemStatus } = useSystemStatus()

  const getStatusIcon = () => {
    if (!systemStatus) return <AlertCircle className="h-4 w-4 text-gray-500" />
    
    switch (systemStatus.overall) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-emerald-400" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-400" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getConnectionIcon = () => {
    if (!systemStatus?.megConnection) {
      return <WifiOff className="h-4 w-4 text-red-400" />
    }
    
    switch (systemStatus.megConnection) {
      case 'healthy':
        return <Wifi className="h-4 w-4 text-emerald-400" />
      case 'warning':
        return <Wifi className="h-4 w-4 text-amber-400" />
      case 'error':
        return <WifiOff className="h-4 w-4 text-red-400" />
      case 'disconnected':
        return <WifiOff className="h-4 w-4 text-red-400" />
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Mobile sidebar */}
      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-900 bg-opacity-75 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Mobile sidebar panel */}
      <div className={clsx(
        "fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 transform transition-transform duration-300 ease-in-out lg:hidden",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between h-20 px-6 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-lg">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold gradient-text">MEG</span>
              <div className="text-sm text-gray-400">Neural Interface System</div>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <nav className="px-4 py-6 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={clsx(
                  'flex items-center px-4 py-2 rounded-lg text-base font-medium transition-colors duration-200',
                  isActive
                    ? 'bg-gray-800 text-white shadow-md'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="h-5 w-5 mr-3" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <div className="glass-dark p-4 space-y-3 rounded-lg bg-gray-800/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">System Status</span>
              {getStatusIcon()}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">MEG Connection</span>
              <div className="flex items-center space-x-2">
                {getConnectionIcon()}
                <div className={clsx(
                  'w-2 h-2 rounded-full',
                  systemStatus?.megConnection === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                )} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Data Rate</span>
              <div className="flex items-center space-x-1">
                <Zap className="h-3 w-3 text-orange-400" />
                <span className="text-sm text-gray-300">375 Hz</span>
              </div>
            </div>
            {systemStatus?.lastCheck && (
              <div className="text-xs text-gray-500 pt-2 border-t border-gray-700/50">
                Last check: {new Date(systemStatus.lastCheck).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-grow bg-gray-900 border-r border-gray-800">
          {/* Logo */}
          <div className="flex items-center h-20 px-6 border-b border-gray-800">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-lg">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold gradient-text">MEG</span>
                <div className="text-sm text-gray-400">Neural Interface System</div>
              </div>
            </div>
          </div>
          
          {/* Navigation */}
          <div className="flex-1 px-4 py-6">
            <nav className="space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={clsx(
                      'flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200',
                      isActive
                        ? 'bg-gray-800 text-white shadow-md'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    )}
                  >
                    <item.icon className="h-5 w-5 mr-3" />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
          
          {/* System Status */}
          <div className="p-4 border-t border-gray-800">
            <div className="glass-dark p-4 space-y-3 rounded-lg bg-gray-800/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">System Status</span>
                {getStatusIcon()}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">MEG Connection</span>
                <div className="flex items-center space-x-2">
                  {getConnectionIcon()}
                  <div className={clsx(
                    'w-2 h-2 rounded-full',
                    systemStatus?.megConnection === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                  )} />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Data Rate</span>
                <div className="flex items-center space-x-1">
                  <Zap className="h-3 w-3 text-orange-400" />
                  <span className="text-sm text-gray-300">375 Hz</span>
                </div>
              </div>
              
              {systemStatus?.lastCheck && (
                <div className="text-xs text-gray-500 pt-2 border-t border-gray-700/50">
                  Last check: {new Date(systemStatus.lastCheck).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72 flex flex-col flex-1">
        {/* Top bar for mobile */}
        <div className="lg:hidden flex items-center justify-between h-16 bg-gray-900 border-b border-gray-800 px-4">
          <div className="flex items-center space-x-3">
            <div className="p-1 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-md">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">MEG</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-gray-950">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
