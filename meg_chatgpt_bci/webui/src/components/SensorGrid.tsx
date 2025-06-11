import React from 'react';
import { useSensorStatus } from '../hooks/useSensorStatus';
import { api } from '../lib/api';
import { SensorStatus } from '../types';

interface SensorLedProps {
  sensorId: number;
  status: { ACT: number; LLS: number; SLS: number; FLS: number; };
  onToggle: (sensorId: number, currentStatus: number) => void;
}

const SensorLed: React.FC<SensorLedProps> = ({ sensorId, status, onToggle }) => {
  const isActive = status.ACT === 1; // Assuming ACT = 1 means active
  const color = isActive ? 'bg-green-500' : 'bg-red-500';
  const tooltip = `Sensor ${sensorId}: ACT=${status.ACT}, LLS=${status.LLS}, SLS=${status.SLS}, FLS=${status.FLS}`;

  return (
    <div
      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white cursor-pointer ${color} transition-colors duration-200`}
      title={tooltip}
      onClick={() => onToggle(sensorId, status.ACT)}
    >
      {sensorId}
    </div>
  );
};

export const SensorGrid: React.FC = () => {
  const { sensorStatus, isLoadingSensorStatus, sensorStatusError } = useSensorStatus();

  console.log('DEBUG: SensorGrid received sensorStatus:', sensorStatus);

  const handleActivateAllSensors = async () => {
    try {
      await api.post('/api/system/sensors/activate_all');
      console.log('Command sent: Activate All Sensors');
    } catch (error) {
      console.error('Failed to send Activate All command:', error);
      alert('Failed to activate all sensors. Check console for details.');
    }
  };

  const handleDeactivateAllSensors = async () => {
    try {
      await api.post('/api/system/sensors/deactivate_all');
      console.log('Command sent: Deactivate All Sensors');
    } catch (error) {
      console.error('Failed to send Deactivate All command:', error);
      alert('Failed to deactivate all sensors. Check console for details.');
    }
  };

  const handleToggleSensor = async (sensorId: number, currentStatus: number) => {
    const activate = currentStatus === 0; // If currentStatus is 0 (inactive), activate it. Otherwise, deactivate.
    try {
      await api.post(`/api/system/sensors/${sensorId}/toggle_stream`, null, {
        params: { activate: activate },
      });
      console.log(`Command sent: ${activate ? 'Activate' : 'Deactivate'} Sensor ${sensorId}`);
      // In a real app, you might refetch sensor status here or rely on refetchInterval
    } catch (error) {
      console.error(`Failed to send toggle command for Sensor ${sensorId}:`, error);
      alert(`Failed to toggle sensor ${sensorId}. Check console for details.`);
    }
  };

  if (isLoadingSensorStatus) {
    return <div className="text-gray-500">Loading sensor status...</div>;
  }

  if (sensorStatusError) {
    return <div className="text-red-500">Error: {sensorStatusError.message}</div>;
  }

  if (!sensorStatus || !sensorStatus.parsed_sensor_statuses) {
    return <div className="text-gray-500">No sensor status data available.</div>;
  }

  const sensors = Object.values(sensorStatus.parsed_sensor_statuses);

  return (
    <div className="p-4 bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-4">Sensor Grid (8x8)</h2>
      <p className="text-gray-400 text-sm mb-4">Click on a sensor to toggle its activation status.</p>
      <div className="flex space-x-4 mb-4">
        <button
          onClick={handleActivateAllSensors}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
        >
          Activate All Sensors
        </button>
        <button
          onClick={handleDeactivateAllSensors}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200"
        >
          Deactivate All Sensors
        </button>
      </div>
      <div className="grid grid-cols-8 gap-2">
        {Array.from({ length: 64 }).map((_, index) => {
          const sensorId = index + 1; // Sensor IDs from 1 to 64
          const status = sensorStatus.parsed_sensor_statuses[sensorId];

          if (!status) {
            return (
              <div
                key={sensorId}
                className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs text-gray-400"
                title={`Sensor ${sensorId}: No data`}
              >
                {sensorId}
              </div>
            );
          }

          return (
            <SensorLed
              key={sensorId}
              sensorId={sensorId}
              status={status}
              onToggle={handleToggleSensor}
            />
          );
        })}
      </div>
      <div className="mt-4 text-gray-400 text-sm">
        <p>Last updated: {new Date(sensorStatus.timestamp * 1000).toLocaleTimeString()}</p>
        <p>Frame Number: {sensorStatus.frame_number}</p>
        <p>Status Strings: {sensorStatus.status_strings}</p>
      </div>
    </div>
  );
};
