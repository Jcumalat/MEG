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
  CheckCircle
} from 'lucide-react'
import { clsx } from 'clsx'
import { useSystemStatus } from '../hooks/useSystemStatus'

interface LayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
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
    if (!systemStatus) return <AlertCircle className="h-4 w-4 text-gray-400" />
    
    switch (systemStatus.overall) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-success-500" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-warning-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-error-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getConnectionIcon = () => {
    if (!systemStatus?.megConnection) {
      return <WifiOff className="h-4 w-4 text-error-500" />
    }
    
    switch (systemStatus.megConnection) {
      case 'healthy':
        return <Wifi className="h-4 w-4 text-success-500" />
      case 'warning':
        return <Wifi className="h-4 w-4 text-warning-500" />
      case 'error':
        return <WifiOff className="h-4 w-4 text-error-500" />
      default:
        return <WifiOff className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={clsx(
        'fixed inset-0 z-50 lg:hidden',
        sidebarOpen ? 'block' : 'hidden'
      )}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex items-center">
              <Brain className="h-8 w-8 text-primary-600" />
              <span className="ml-2 text-lg font-semibold text-gray-900">MEG BCI</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-2 text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={clsx(
                    'group flex items-center px-2 py-2 text-sm font-medium rounded-md',
                    isActive
                      ? 'bg-primary-100 text-primary-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <item.icon
                    className={clsx(
                      'mr-3 h-5 w-5',
                      isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
                    )}
                  />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <Brain className="h-8 w-8 text-primary-600" />
            <span className="ml-2 text-lg font-semibold text-gray-900">MEG BCI System</span>
          </div>
          <div className="mt-5 flex-grow flex flex-col">
            <nav className="flex-1 px-2 space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={clsx(
                      'group flex items-center px-2 py-2 text-sm font-medium rounded-md',
                      isActive
                        ? 'bg-primary-100 text-primary-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <item.icon
                      className={clsx(
                        'mr-3 h-5 w-5',
                        isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
                      )}
                    />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
          
          {/* System status footer */}
          <div className="flex-shrink-0 px-4 py-4 border-t border-gray-200">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>System Status</span>
                {getStatusIcon()}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>MEG Connection</span>
                {getConnectionIcon()}
              </div>
              {systemStatus?.lastCheck && (
                <div className="text-xs text-gray-400">
                  Last check: {new Date(systemStatus.lastCheck).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow">
          <button
            onClick={() => setSidebarOpen(true)}
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="flex-1 px-4 flex justify-between items-center">
            <div className="flex-1 flex">
              <h1 className="text-lg font-semibold text-gray-900 capitalize">
                {location.pathname === '/' ? 'Dashboard' : location.pathname.slice(1)}
              </h1>
            </div>
            
            {/* Status indicators */}
            <div className="ml-4 flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {getConnectionIcon()}
                <span className="text-sm text-gray-500">
                  {systemStatus?.megConnection === 'healthy' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                {getStatusIcon()}
                <span className="text-sm text-gray-500 capitalize">
                  {systemStatus?.overall || 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
