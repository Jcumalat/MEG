import { useQuery } from '@tanstack/react-query'
import { SystemHealth } from '../types'
import { api } from '../lib/api'

export function useSystemStatus() {
  return useQuery<SystemHealth>({
    queryKey: ['system-status'],
    queryFn: () => api.get('/api/system/status'),
    refetchInterval: 5000, // Refetch every 5 seconds
    staleTime: 1000, // Consider data stale after 1 second
  })
}
