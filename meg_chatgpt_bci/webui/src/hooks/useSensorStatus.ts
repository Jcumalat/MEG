import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { SensorStatus } from '../types';

const SENSOR_STATUS_QUERY_KEY = 'sensorStatus';

const defaultSensorStatus: SensorStatus = {
  frame_number: 0,
  payload_size_from_header_field: 0,
  num_sensors: 0,
  actual_payload_size_for_status: 0,
  status_strings: '',
  status_values_raw_hex: '',
  parsed_sensor_statuses: {},
  timestamp: 0,
};

export function useSensorStatus() {
  const { data, isLoading, error, refetch } = useQuery<SensorStatus, Error>({
    queryKey: [SENSOR_STATUS_QUERY_KEY],
    queryFn: async () => {
      const response = await api.system.getSensorStatus(); // Corrected API call
      // Ensure data is never undefined, return default if API returns null/undefined
      return response || defaultSensorStatus; // api.get returns data directly due to interceptor
    },
    refetchInterval: 1000, // Refetch every 1 second to get real-time updates
    staleTime: 500, // Data is considered stale after 0.5 seconds
    gcTime: 5 * 60 * 1000, // Cache data for 5 minutes (renamed from cacheTime in React Query v4+)
  });

  return {
    sensorStatus: data,
    isLoadingSensorStatus: isLoading,
    sensorStatusError: error,
    refetchSensorStatus: refetch,
  };
}
