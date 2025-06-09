"""
Phantom Controller for MEG system calibration and testing.
"""

import numpy as np
import time
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class PhantomMode(Enum):
    """Phantom operation modes."""
    IDLE = "idle"
    CALIBRATION = "calibration"
    TESTING = "testing"
    NOISE_MEASUREMENT = "noise_measurement"


@dataclass
class PhantomConfig:
    """Configuration for phantom controller."""
    frequency: float = 10.0  # Hz
    amplitude: float = 1.0   # nT
    duration: float = 60.0   # seconds
    channels: List[int] = None  # Target channels
    waveform: str = "sine"   # sine, square, triangle, noise


class PhantomController:
    """Controller for MEG phantom operations."""
    
    def __init__(self):
        self.mode = PhantomMode.IDLE
        self.is_active = False
        self.current_config: Optional[PhantomConfig] = None
        self.start_time: Optional[float] = None
        self.generated_data: List[np.ndarray] = []
        
    def configure(self, config: PhantomConfig) -> bool:
        """Configure phantom parameters."""
        try:
            if config.channels is None:
                config.channels = list(range(306))  # Default to all MEG channels
            
            self.current_config = config
            logger.info(f"Phantom configured: {config}")
            return True
        except Exception as e:
            logger.error(f"Phantom configuration failed: {e}")
            return False
    
    def start_calibration(self, config: PhantomConfig) -> bool:
        """Start phantom calibration sequence."""
        if not self.configure(config):
            return False
        
        try:
            self.mode = PhantomMode.CALIBRATION
            self.is_active = True
            self.start_time = time.time()
            self.generated_data = []
            
            logger.info("Phantom calibration started")
            return True
        except Exception as e:
            logger.error(f"Failed to start phantom calibration: {e}")
            return False
    
    def start_testing(self, config: PhantomConfig) -> bool:
        """Start phantom testing sequence."""
        if not self.configure(config):
            return False
        
        try:
            self.mode = PhantomMode.TESTING
            self.is_active = True
            self.start_time = time.time()
            self.generated_data = []
            
            logger.info("Phantom testing started")
            return True
        except Exception as e:
            logger.error(f"Failed to start phantom testing: {e}")
            return False
    
    def start_noise_measurement(self, duration: float = 60.0) -> bool:
        """Start noise measurement with phantom off."""
        config = PhantomConfig(
            frequency=0.0,
            amplitude=0.0,
            duration=duration,
            waveform="none"
        )
        
        if not self.configure(config):
            return False
        
        try:
            self.mode = PhantomMode.NOISE_MEASUREMENT
            self.is_active = True
            self.start_time = time.time()
            self.generated_data = []
            
            logger.info("Noise measurement started")
            return True
        except Exception as e:
            logger.error(f"Failed to start noise measurement: {e}")
            return False
    
    def stop(self):
        """Stop phantom operation."""
        self.is_active = False
        self.mode = PhantomMode.IDLE
        logger.info("Phantom stopped")
    
    def generate_signal(self, timestamp: float, num_samples: int = 1) -> np.ndarray:
        """Generate phantom signal for given timestamp."""
        if not self.is_active or not self.current_config:
            return np.zeros((num_samples, 306))
        
        if self.mode == PhantomMode.NOISE_MEASUREMENT:
            return np.zeros((num_samples, 306))
        
        # Calculate time since start
        elapsed_time = timestamp - self.start_time if self.start_time else 0
        
        # Check if duration exceeded
        if elapsed_time > self.current_config.duration:
            self.stop()
            return np.zeros((num_samples, 306))
        
        # Generate time array
        dt = 1.0 / 1000.0  # Assuming 1kHz sampling rate
        t = np.linspace(elapsed_time, elapsed_time + (num_samples - 1) * dt, num_samples)
        
        # Generate waveform
        signal = self._generate_waveform(t)
        
        # Create full channel array
        data = np.zeros((num_samples, 306))
        for channel in self.current_config.channels:
            if 0 <= channel < 306:
                data[:, channel] = signal
        
        # Store generated data for analysis
        self.generated_data.append(data)
        
        return data
    
    def _generate_waveform(self, t: np.ndarray) -> np.ndarray:
        """Generate specific waveform type."""
        if not self.current_config:
            return np.zeros_like(t)
        
        freq = self.current_config.frequency
        amp = self.current_config.amplitude
        waveform = self.current_config.waveform.lower()
        
        if waveform == "sine":
            return amp * np.sin(2 * np.pi * freq * t)
        elif waveform == "square":
            return amp * np.sign(np.sin(2 * np.pi * freq * t))
        elif waveform == "triangle":
            return amp * (2 / np.pi) * np.arcsin(np.sin(2 * np.pi * freq * t))
        elif waveform == "noise":
            return amp * np.random.normal(0, 1, len(t))
        else:
            return np.zeros_like(t)
    
    def get_status(self) -> Dict:
        """Get current phantom status."""
        status = {
            "mode": self.mode.value,
            "is_active": self.is_active,
            "elapsed_time": 0.0,
            "remaining_time": 0.0,
            "config": None
        }
        
        if self.start_time and self.current_config:
            elapsed = time.time() - self.start_time
            status["elapsed_time"] = elapsed
            status["remaining_time"] = max(0, self.current_config.duration - elapsed)
            status["config"] = {
                "frequency": self.current_config.frequency,
                "amplitude": self.current_config.amplitude,
                "duration": self.current_config.duration,
                "channels": len(self.current_config.channels),
                "waveform": self.current_config.waveform
            }
        
        return status
    
    def get_generated_data(self) -> np.ndarray:
        """Get all generated phantom data."""
        if not self.generated_data:
            return np.array([])
        
        return np.vstack(self.generated_data)
    
    def analyze_phantom_response(self, measured_data: np.ndarray) -> Dict:
        """Analyze phantom response in measured data."""
        if not self.current_config or len(self.generated_data) == 0:
            return {"error": "No phantom data available for analysis"}
        
        try:
            expected_data = self.get_generated_data()
            
            if measured_data.shape != expected_data.shape:
                return {"error": "Data shape mismatch"}
            
            # Calculate correlation for phantom channels
            correlations = []
            snr_values = []
            
            for channel in self.current_config.channels:
                if 0 <= channel < min(measured_data.shape[1], expected_data.shape[1]):
                    measured_ch = measured_data[:, channel]
                    expected_ch = expected_data[:, channel]
                    
                    # Calculate correlation
                    if np.std(measured_ch) > 0 and np.std(expected_ch) > 0:
                        corr = np.corrcoef(measured_ch, expected_ch)[0, 1]
                        correlations.append(corr)
                        
                        # Calculate SNR
                        signal_power = np.mean(expected_ch ** 2)
                        noise_power = np.mean((measured_ch - expected_ch) ** 2)
                        if noise_power > 0:
                            snr = 10 * np.log10(signal_power / noise_power)
                            snr_values.append(snr)
            
            analysis = {
                "mean_correlation": np.mean(correlations) if correlations else 0.0,
                "std_correlation": np.std(correlations) if correlations else 0.0,
                "mean_snr_db": np.mean(snr_values) if snr_values else 0.0,
                "std_snr_db": np.std(snr_values) if snr_values else 0.0,
                "num_channels_analyzed": len(correlations),
                "phantom_detected": np.mean(correlations) > 0.5 if correlations else False
            }
            
            return analysis
            
        except Exception as e:
            logger.error(f"Phantom analysis failed: {e}")
            return {"error": str(e)}
    
    def create_calibration_sequence(self) -> List[PhantomConfig]:
        """Create a sequence of calibration configurations."""
        sequences = []
        
        # Frequency sweep
        for freq in [1, 5, 10, 20, 40, 80]:
            sequences.append(PhantomConfig(
                frequency=freq,
                amplitude=1.0,
                duration=30.0,
                waveform="sine"
            ))
        
        # Amplitude sweep
        for amp in [0.1, 0.5, 1.0, 2.0, 5.0]:
            sequences.append(PhantomConfig(
                frequency=10.0,
                amplitude=amp,
                duration=20.0,
                waveform="sine"
            ))
        
        # Waveform types
        for waveform in ["sine", "square", "triangle"]:
            sequences.append(PhantomConfig(
                frequency=10.0,
                amplitude=1.0,
                duration=30.0,
                waveform=waveform
            ))
        
        return sequences
