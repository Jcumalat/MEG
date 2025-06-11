import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useSystemStatus } from './useSystemStatus' // Import useSystemStatus
import { MEGConnectionStatus, MEGMonitorHookData } from '../types' // Import MEGConnectionStatus and MEGMonitorHookData

export function useMEGMonitorData() {
  const { data: systemStatus } = useSystemStatus() // Get system status
  const isConnected = systemStatus?.megConnection === 'healthy' // Check if MEG is connected

  const { data, isLoading, error } = useQuery<MEGMonitorHookData, Error>({
    queryKey: ['meg-monitor-data'],
    queryFn: async () => {
      const response = await api.get('/api/meg/data/monitor');
      // Ensure data, samplingRate, and channels are always present, even if null from API
      return {
        data: response.data || [],
        samplingRate: response.samplingRate || 0,
        channels: response.channels || 0,
      };
    },
    refetchInterval: isConnected ? 100 : false, // Only refetch if connected
    staleTime: isConnected ? 50 : Infinity, // Data is stale quickly if connected, never if disconnected
    enabled: isConnected, // Only fetch if connected
  })

  // If disconnected, return no data, but indicate loading if still trying to connect
  if (!isConnected) {
    return {
      data: undefined, // Explicitly no data when disconnected
      isLoading: false, // Not loading real data if disconnected
      error: null,      // No error for mock data
    }
  }

  return {
    data: data,
    isLoading,
    error,
  }
}
