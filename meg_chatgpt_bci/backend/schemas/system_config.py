from pydantic import BaseModel
from typing import List, Optional, Dict # Import Dict
from enum import Enum

class MEGConnectionStatus(str, Enum):
    HEALTHY = "healthy"
    DISCONNECTED = "disconnected"

class SystemHealth(BaseModel):
    megConnection: MEGConnectionStatus
    status: str = "operational" # Keep existing status for now

class MEGConfig(BaseModel):
    host: str = "192.168.0.10"
    port: int = 8089
    samplingRate: int = 375
    channels: int = 192
    timeout: int = 10000

class SignalProcessingConfig(BaseModel):
    filterLow: float = 8
    filterHigh: float = 30
    filterOrder: int = 4
    cspComponents: int = 8
    windowSize: int = 750
    noiseReduction: dict = {
        "enabled": True,
        "methods": ["svd", "spatial"]
    }

class PhantomConfig(BaseModel):
    frequency: float = 10
    amplitude: float = 1.0
    duration: int = 5
    channels: List[int] = [1, 2, 3, 4]
    waveform: str = 'sine'

class SystemConfig(BaseModel):
    meg: MEGConfig
    signalProcessing: SignalProcessingConfig
    phantom: PhantomConfig

class SensorStatus(BaseModel):
    frame_number: int
    payload_size_from_header_field: int
    num_sensors: int
    actual_payload_size_for_status: int
    status_strings: str
    status_values_raw_hex: str
    parsed_sensor_statuses: Dict[int, Dict[str, int]]
    timestamp: float
