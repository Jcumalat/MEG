"""
Enhanced MEG Connection Module
High-performance MEG data acquisition with confirmed frame structure
Optimized for real-time processing with modern async/await patterns
"""

import socket
import struct
import numpy as np
import time
import asyncio
import threading
import queue
from collections import deque
import logging
from typing import Optional, Callable, Dict, Any, List
from dataclasses import dataclass
from enum import Enum
import json
from pathlib import Path

logger = logging.getLogger('MEG_BCI.meg_connection')


class ConnectionState(Enum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    STREAMING = "streaming"
    ERROR = "error"


@dataclass
class MEGFrame:
    """Data class for MEG frame information"""
    frame_number: int
    data: np.ndarray
    timestamp: float
    n_samples: int
    n_channels: int
    frame_type: str = "CONFIRMED"
    quality_score: float = 1.0


@dataclass
class ConnectionStats:
    """Data class for connection statistics"""
    connected: bool
    streaming: bool
    total_frames_parsed: int
    parse_success_rate: float
    sync_losses: int
    current_fps: float
    current_throughput_mbps: float
    total_bytes_received: int
    buffer_size: int
    queue_sizes: Dict[str, int]
    last_data_time: float
    connection_stable: bool
    channel_activity: Optional[Dict[str, Any]] = None


class EnhancedMEGConnection:
    """
    Enhanced MEG connection with modern async patterns and robust error handling
    Based on confirmed frame structure from legacy systems
    """
    
    def __init__(self, host='192.168.0.10', port=8089, buffer_size=8192):
        self.host = host
        self.port = port
        self.buffer_size = buffer_size
        self.socket = None
        self.state = ConnectionState.DISCONNECTED
        
        # CONFIRMED: Exact frame structure from previous analysis (Port 8089 - Sensor Data)
        self.FRAME_START_MARKER = b'KCLB'   # Frame start marker (Reverted - observed markers d8be8d00, ce80ce3f are inconsistent)
        self.PAYLOAD_END_MARKER = b'DNEB'     # Payload end marker (Param from PDF)
        self.FRAME_FINAL_END_MARKER = b'KCLB' # Final frame end marker (from PDF)
        self.HEADER_SIZE = 20        # 5 × uint32_t
        self.PAYLOAD_SIZE = 16384    # 4096 float32 values
        self.FOOTER_SIZE = 12        # DNEB + Checksum + KCLB
        self.TOTAL_FRAME_SIZE = 16416  # Total frame size
        
        # CONFIRMED: Data structure
        self.SAMPLES_PER_FRAME = 16    # 16 samples per frame
        self.CHANNELS_PER_FRAME = 256  # 256 channels per frame
        self.EXPECTED_FLOATS = 4096    # 16 × 256 = 4096
        
        # MEG system parameters
        self.n_sensors = 64            # Physical sensors
        self.n_channels = 192          # MEG channels for output
        self.sampling_rate = 375       # Hz
        self.frame_rate = 23.4         # 375 ÷ 16 ≈ 23.4 Hz
        
        # High-performance data structures
        self.data_queue = queue.Queue(maxsize=1000)
        self.monitor_queue = queue.Queue(maxsize=50)
        self.prediction_queue = queue.Queue(maxsize=200)
        
        # Circular buffers for efficiency
        self.raw_buffer = deque(maxlen=10000)  # Store last ~7 minutes at 375Hz
        self.processed_buffer = deque(maxlen=5000)
        
        # Threading and async
        self.stream_thread = None
        self.processing_thread = None
        self.running = False
        self._loop = None
        
        # Performance monitoring
        self.total_bytes_received = 0
        self.total_frames_parsed = 0
        self.frames_with_errors = 0
        self.sync_losses = 0
        self.parse_success_rate = 0.0
        self.current_throughput_mbps = 0.0
        
        # Timing and FPS
        self.last_frame_time = 0
        self.frame_intervals = deque(maxlen=100)
        self.current_fps = 0.0
        
        # Connection health
        self.last_data_time = 0
        self.connection_stable = False
        self.consecutive_errors = 0
        
        # Data callbacks
        self.data_callbacks: List[Callable] = []
        self.error_callbacks: List[Callable] = []
        self.status_callbacks: List[Callable] = []
        
        # Advanced buffering
        self.frame_buffer = b''
        self.max_buffer_size = 100000  # 100KB max buffer
        
        # Prediction collection
        self.prediction_active = False
        self.prediction_start_time = 0
        self.prediction_duration = 0
        
        logger.info(f"🔧 Enhanced MEG Connection initialized")
        logger.info(f"   Target: {self.host}:{self.port}")
        logger.info(f"   Frame structure: {self.SAMPLES_PER_FRAME}×{self.CHANNELS_PER_FRAME} → {self.SAMPLES_PER_FRAME}×{self.n_channels}")
    
    def add_data_callback(self, callback: Callable[[np.ndarray, MEGFrame], None]):
        """Add callback function for new data (real-time processing)"""
        self.data_callbacks.append(callback)
    
    def add_error_callback(self, callback: Callable[[Exception], None]):
        """Add callback function for errors"""
        self.error_callbacks.append(callback)
    
    def add_status_callback(self, callback: Callable[[ConnectionState], None]):
        """Add callback function for status changes"""
        self.status_callbacks.append(callback)
    
    def _set_state(self, new_state: ConnectionState):
        """Set connection state and notify callbacks"""
        if self.state != new_state:
            old_state = self.state
            self.state = new_state
            logger.info(f"🔄 State change: {old_state.value} → {new_state.value}")
            
            for callback in self.status_callbacks:
                try:
                    callback(new_state)
                except Exception as e:
                    logger.error(f"Status callback error: {e}")
    
    async def test_connection_async(self, timeout=5.0) -> Optional[Dict[str, Any]]:
        """Async connection test with performance measurement"""
        logger.info(f"🔍 Testing connection to {self.host}:{self.port}")
        
        try:
            # Create connection
            start_time = time.perf_counter()
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port),
                timeout=timeout
            )
            connection_time = time.perf_counter() - start_time
            
            # Test data reception
            test_start = time.perf_counter()
            all_data = b''
            target_size = self.TOTAL_FRAME_SIZE * 3  # 3 frames minimum
            
            while len(all_data) < target_size:
                try:
                    data = await asyncio.wait_for(reader.read(self.buffer_size), timeout=1.0)
                    if not data:
                        break
                    all_data += data
                except asyncio.TimeoutError:
                    break
            
            writer.close()
            await writer.wait_closed()
            
            data_time = time.perf_counter() - test_start
            throughput_mbps = (len(all_data) * 8) / (data_time * 1000000) if data_time > 0 else 0
            
            logger.info(f"   📊 Connection time: {connection_time*1000:.1f}ms")
            logger.info(f"   📊 Data received: {len(all_data)} bytes in {data_time:.3f}s")
            logger.info(f"   📊 Throughput: {throughput_mbps:.1f} Mbps")
            
            frames_found = 0
            if len(all_data) >= self.TOTAL_FRAME_SIZE:
                # Test frame parsing
                buffer_pos = 0
                
                while buffer_pos < len(all_data) - self.TOTAL_FRAME_SIZE:
                    if self._parse_frame_at_position(all_data, buffer_pos) is not None:
                        frames_found += 1
                        buffer_pos += self.TOTAL_FRAME_SIZE
                    else:
                        buffer_pos += 1
                
                logger.info(f"   📦 Frames parsed: {frames_found}")
                
                if frames_found > 0:
                    logger.info("✅ Connection test successful")
                    return {
                        "connection_time": connection_time,
                        "throughput_mbps": throughput_mbps,
                        "frames_found": frames_found,
                        "total_bytes_received": len(all_data)
                    }
            
            logger.warning("⚠️ No valid frames found")
            return None
            
        except Exception as e:
            logger.error(f"❌ Connection test failed: {e}")
            return None
    
    def test_connection(self, timeout=5.0) -> bool:
        """Synchronous wrapper for connection test"""
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(self.test_connection_async(timeout))
            return result is not None # Return boolean based on whether result was found
        finally:
            loop.close()
    
    def connect_and_stream(self) -> bool:
        """Establish connection and start high-performance streaming"""
        if self.state in [ConnectionState.CONNECTED, ConnectionState.STREAMING]:
            logger.warning("Already connected")
            return True
        
        try:
            self._set_state(ConnectionState.CONNECTING)
            logger.info(f"🔗 Attempting to connect socket to {self.host}:{self.port}")
            
            # Create socket with optimizations
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)  # Disable Nagle
            
            # Large receive buffer for high throughput
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 1024*1024)  # 1MB
            
            self.socket.settimeout(10.0)
            self.socket.connect((self.host, self.port))
            logger.info(f"✅ Socket connected to {self.host}:{self.port}")
            self._set_state(ConnectionState.CONNECTED)
            
            # Reset performance counters
            self._reset_performance_counters()
            
            # Start streaming threads
            self.running = True
            self.stream_thread = threading.Thread(target=self._high_performance_stream, daemon=True)
            self.processing_thread = threading.Thread(target=self._data_processing_loop, daemon=True)
            
            self.stream_thread.start()
            self.processing_thread.start()
            
            self._set_state(ConnectionState.STREAMING)
            logger.info("✅ Connected and streaming started")
            return True
            
        except socket.timeout as e:
            logger.error(f"❌ Connection timed out to {self.host}:{self.port}: {e}")
            self._set_state(ConnectionState.ERROR)
            for callback in self.error_callbacks:
                try:
                    callback(e)
                except:
                    pass
            return False
        except ConnectionRefusedError as e:
            logger.error(f"❌ Connection refused by {self.host}:{self.port}. Is the MEG system running and accessible? {e}")
            self._set_state(ConnectionState.ERROR)
            for callback in self.error_callbacks:
                try:
                    callback(e)
                except:
                    pass
            return False
        except Exception as e:
            logger.error(f"❌ General connection error to {self.host}:{self.port}: {e}", exc_info=True)
            self._set_state(ConnectionState.ERROR)
            for callback in self.error_callbacks:
                try:
                    callback(e)
                except:
                    pass
            return False
    
    def _reset_performance_counters(self):
        """Reset all performance counters"""
        self.total_bytes_received = 0
        self.total_frames_parsed = 0
        self.frames_with_errors = 0
        self.sync_losses = 0
        self.consecutive_errors = 0
        self.last_frame_time = time.perf_counter()
        self.frame_intervals.clear()
        self.frame_buffer = b''
    
    def _high_performance_stream(self):
        """High-performance streaming thread with optimized buffering"""
        logger.info("🔄 Starting high-performance streaming")
        
        consecutive_empty_reads = 0
        last_stats_time = time.perf_counter()
        bytes_since_last_stats = 0
        
        while self.running and self.state in [ConnectionState.CONNECTED, ConnectionState.STREAMING]:
            try:
                # Set short timeout for responsiveness
                self.socket.settimeout(0.1)
                data_chunk = self.socket.recv(self.buffer_size)
                
                if not data_chunk:
                    consecutive_empty_reads += 1
                    if consecutive_empty_reads > 50:  # 5 seconds of empty reads
                        logger.error("❌ Too many empty reads, connection may be lost")
                        self._set_state(ConnectionState.ERROR)
                        break
                    continue
                
                consecutive_empty_reads = 0
                data_size = len(data_chunk)
                self.total_bytes_received += data_size
                bytes_since_last_stats += data_size
                self.last_data_time = time.perf_counter()
                
                # Add to frame buffer
                self.frame_buffer += data_chunk
                
                # Process complete frames
                self._process_frame_buffer()
                
                # Periodic performance logging (every 60 seconds)
                current_time = time.perf_counter()
                if current_time - last_stats_time > 60.0:
                    self._log_performance_stats(bytes_since_last_stats, current_time - last_stats_time)
                    last_stats_time = current_time
                    bytes_since_last_stats = 0
                
            except socket.timeout:
                continue
            except Exception as e:
                self.consecutive_errors += 1
                if self.consecutive_errors > 10:
                    logger.error(f"❌ Too many consecutive errors: {e}")
                    self._set_state(ConnectionState.ERROR)
                    break
                logger.debug(f"Stream error: {e}")
                time.sleep(0.01)
        
        self._set_state(ConnectionState.DISCONNECTED)
        logger.info("🔄 High-performance streaming stopped")
    
    def _process_frame_buffer(self):
        """Process frames from buffer with high efficiency"""
        frames_processed = 0
        max_frames_per_cycle = 10  # Limit to prevent blocking
        
        while len(self.frame_buffer) >= self.TOTAL_FRAME_SIZE and frames_processed < max_frames_per_cycle:
            # Try to parse frame at current position
            frame_data = self._parse_frame_at_position(self.frame_buffer, 0)
            
            if frame_data is not None:
                # Successful frame parse
                current_time = time.perf_counter()
                
                # Create frame object
                parsed_frame = MEGFrame(
                    frame_number=self.total_frames_parsed + 1,
                    data=frame_data,
                    timestamp=current_time,
                    n_samples=frame_data.shape[0],
                    n_channels=frame_data.shape[1],
                    quality_score=self._calculate_frame_quality(frame_data)
                )
                
                # Update timing statistics
                if self.last_frame_time > 0:
                    interval = current_time - self.last_frame_time
                    self.frame_intervals.append(interval)
                    self.current_fps = 1.0 / np.mean(self.frame_intervals) if self.frame_intervals else 0
                
                self.last_frame_time = current_time
                
                # Distribute frame to queues and callbacks
                self._distribute_frame_data(parsed_frame)
                
                # Advance buffer
                self.frame_buffer = self.frame_buffer[self.TOTAL_FRAME_SIZE:]
                self.total_frames_parsed += 1
                frames_processed += 1
                self.consecutive_errors = 0
                
            else:
                # Frame parsing failed - find next sync
                sync_pos = self._find_next_sync_position()
                if sync_pos > 0:
                    self.frame_buffer = self.frame_buffer[sync_pos:]
                    self.sync_losses += 1
                else:
                    # No sync found, need more data
                    break
        
        # Manage buffer size
        if len(self.frame_buffer) > self.max_buffer_size:
            # Keep only the last portion
            self.frame_buffer = self.frame_buffer[-self.max_buffer_size//2:]
            logger.debug(f"Trimmed frame buffer to {len(self.frame_buffer)} bytes")
        
        # Update parse success rate
        total_attempts = self.total_frames_parsed + self.sync_losses
        self.parse_success_rate = (self.total_frames_parsed / max(1, total_attempts)) * 100
    
    def _calculate_frame_quality(self, frame_data: np.ndarray) -> float:
        """Calculate frame quality score based on signal characteristics"""
        try:
            # Basic quality metrics
            signal_variance = np.var(frame_data)
            signal_mean = np.abs(np.mean(frame_data))
            
            # Check for reasonable signal levels
            if signal_variance < 1e-10:  # Too low variance (flat signal)
                return 0.1
            if signal_variance > 1e6:   # Too high variance (likely noise)
                return 0.3
            if signal_mean > 1e3:       # DC offset too high
                return 0.5
            
            # Check for NaN or infinite values
            if np.any(np.isnan(frame_data)) or np.any(np.isinf(frame_data)):
                return 0.0
            
            # Good signal
            return 1.0
            
        except Exception:
            return 0.5  # Default quality if calculation fails
    
    def _parse_frame_at_position(self, buffer: bytes, position: int) -> Optional[np.ndarray]:
        """Parse frame at specific buffer position with validation"""
        if position + self.TOTAL_FRAME_SIZE > len(buffer):
            return None
        
        frame_data = buffer[position:position + self.TOTAL_FRAME_SIZE]
        
        try:
            # Validate frame start
            if frame_data[:4] != self.FRAME_START_MARKER:
                logger.warning(f"[EnhancedMEG] Frame start marker mismatch. Expected: {self.FRAME_START_MARKER.hex()}, Got: {frame_data[:4].hex()}")
                return None
            
            # Parse header
            header_values = struct.unpack('<5I', frame_data[:self.HEADER_SIZE])
            payload_size = header_values[2]
            n_sensors = header_values[3]
            acquisition_rate = header_values[4]
            
            # Validate header values
            logger.info(f"[EnhancedMEG] Attempting to parse frame. Received Header Values: payload_size_from_header={payload_size}, n_sensors_from_header={n_sensors}, acquisition_rate_from_header={acquisition_rate}")
            logger.info(f"[EnhancedMEG] Expected Header Values: PAYLOAD_SIZE={self.PAYLOAD_SIZE}, n_sensors={self.n_sensors}, sampling_rate={self.sampling_rate}")

            valid_payload_size = payload_size == self.PAYLOAD_SIZE
            valid_n_sensors = n_sensors == self.n_sensors
            valid_acquisition_rate = acquisition_rate == self.sampling_rate

            if not (valid_payload_size and valid_n_sensors and valid_acquisition_rate):
                logger.warning(f"[EnhancedMEG] Header value mismatch:")
                if not valid_payload_size:
                    logger.warning(f"  Payload Size: Expected {self.PAYLOAD_SIZE}, Got {payload_size}")
                if not valid_n_sensors:
                    logger.warning(f"  Num Sensors: Expected {self.n_sensors}, Got {n_sensors}")
                if not valid_acquisition_rate:
                    logger.warning(f"  Acq Rate: Expected {self.sampling_rate}, Got {acquisition_rate}")
                return None
            
            # Extract and validate payload
            payload_start = self.HEADER_SIZE
            payload_end = payload_start + self.PAYLOAD_SIZE
            payload_data = frame_data[payload_start:payload_end]
            
            # Parse as float32 array
            float_array = np.frombuffer(payload_data, dtype='<f4')
            if len(float_array) != self.EXPECTED_FLOATS:
                logger.debug(f"Float array length mismatch: {len(float_array)}/{self.EXPECTED_FLOATS}")
                return None
            
            # Reshape to confirmed structure
            sensor_data = float_array.reshape((self.SAMPLES_PER_FRAME, self.CHANNELS_PER_FRAME))
            
            # Validate footer
            footer_start = payload_end
            footer_data = frame_data[footer_start:footer_start + self.FOOTER_SIZE]
            
            if len(footer_data) < self.FOOTER_SIZE:
                logger.debug("Incomplete footer data.")
                return None

            payload_end_marker_received = footer_data[0:4]
            checksum_received = struct.unpack('<I', footer_data[4:8])[0] # Checksum is 4 bytes
            frame_final_end_marker_received = footer_data[8:12] # Final KCLB is 4 bytes
            
            valid_payload_end_marker = payload_end_marker_received == self.PAYLOAD_END_MARKER
            valid_frame_final_end_marker = frame_final_end_marker_received == self.FRAME_FINAL_END_MARKER

            if valid_payload_end_marker and valid_frame_final_end_marker:
                # Extract MEG channels (first 192 of 256)
                meg_data = sensor_data[:, :self.n_channels]
                return meg_data
            
            logger.warning(f"[EnhancedMEG] Footer marker mismatch:")
            if not valid_payload_end_marker:
                logger.warning(f"  Payload End Marker: Expected {self.PAYLOAD_END_MARKER.hex()}, Got {payload_end_marker_received.hex()}")
            if not valid_frame_final_end_marker:
                logger.warning(f"  Frame Final End Marker: Expected {self.FRAME_FINAL_END_MARKER.hex()}, Got {frame_final_end_marker_received.hex()}")
            return None
            
        except Exception as e:
            logger.debug(f"Frame parsing error at position {position}: {e}")
            return None
    
    def _find_next_sync_position(self) -> int:
        """Find next frame sync position in buffer"""
        for i in range(1, len(self.frame_buffer) - self.HEADER_SIZE):
            if self.frame_buffer[i:i+4] == self.FRAME_START_MARKER:
                # Quick validation - check if header looks valid
                try:
                    header_values = struct.unpack('<5I', self.frame_buffer[i:i+self.HEADER_SIZE])
                    if (header_values[2] == self.PAYLOAD_SIZE and 
                        header_values[3] == self.n_sensors and
                        header_values[4] == self.sampling_rate):
                        return i
                except (struct.error, IndexError): # Catch struct.error for incomplete headers
                    continue
        return 0
    
    def _distribute_frame_data(self, frame: MEGFrame):
        """Distribute frame data to various queues and callbacks"""
        frame_data = frame.data
        
        # Add to raw buffer
        for sample in frame_data:
            self.raw_buffer.append(sample)
        
        # Add to monitor queue (non-blocking) - always keep fresh data
        try:
            # If queue is full, remove old items to make space for fresh data
            while self.monitor_queue.qsize() >= 45:
                try:
                    self.monitor_queue.get_nowait()
                except queue.Empty:
                    break
            self.monitor_queue.put_nowait(frame)
        except queue.Full:
            # Force clear some space and retry
            try:
                self.monitor_queue.get_nowait()
                self.monitor_queue.put_nowait(frame)
            except:
                pass
        
        # Add to main data queue
        try:
            if self.data_queue.qsize() < 900:  # Keep some space
                self.data_queue.put_nowait(frame)
        except queue.Full:
            # Remove oldest item and add new one
            try:
                self.data_queue.get_nowait()
                self.data_queue.put_nowait(frame)
            except queue.Empty:
                pass
        
        # Prediction queue
        if self.prediction_active:
            current_time = time.perf_counter()
            elapsed = current_time - self.prediction_start_time
            
            if elapsed <= self.prediction_duration:
                try:
                    if self.prediction_queue.qsize() < 190:
                        self.prediction_queue.put_nowait(frame)
                except queue.Full:
                    try:
                        self.prediction_queue.get_nowait()
                        self.prediction_queue.put_nowait(frame)
                    except queue.Empty:
                        pass
            else:
                self.prediction_active = False
        
        # Call data callbacks
        for callback in self.data_callbacks:
            try:
                callback(frame_data, frame)
            except Exception as e:
                logger.error(f"Data callback error: {e}")
    
    def _data_processing_loop(self):
        """Background data processing loop"""
        while self.running:
            try:
                # Get frame from queue
                frame = self.data_queue.get(timeout=0.1)
                
                # Add to processed buffer
                for sample in frame.data:
                    self.processed_buffer.append(sample)
                
                self.data_queue.task_done()
                
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"Data processing error: {e}")
    
    def _log_performance_stats(self, bytes_received: int, time_elapsed: float):
        """Log performance statistics"""
        self.current_throughput_mbps = (bytes_received * 8) / (time_elapsed * 1000000)
        
        logger.info(f"📊 Performance Stats:")
        logger.info(f"   Frames parsed: {self.total_frames_parsed}")
        logger.info(f"   Parse success: {self.parse_success_rate:.1f}%")
        logger.info(f"   Current FPS: {self.current_fps:.1f}")
        logger.info(f"   Throughput: {self.current_throughput_mbps:.1f} Mbps")
        logger.info(f"   Buffer size: {len(self.frame_buffer)} bytes")
        logger.info(f"   Queue sizes: Data={self.data_queue.qsize()}, Monitor={self.monitor_queue.qsize()}")
    
    def get_monitor_data(self, max_samples=100, timeout=0.1) -> Optional[np.ndarray]:
        """Get recent data for monitoring/visualization"""
        frames = []
        samples_collected = 0
        
        # Try to get at least one frame, wait briefly if needed
        try:
            if self.monitor_queue.empty():
                # Wait briefly for data to arrive
                frame = self.monitor_queue.get(timeout=timeout)
                frames.append(frame.data)
                samples_collected += frame.data.shape[0]
        except queue.Empty:
            return None
        
        # Get additional frames if available
        while not self.monitor_queue.empty() and samples_collected < max_samples:
            try:
                frame = self.monitor_queue.get_nowait()
                frames.append(frame.data)
                samples_collected += frame.data.shape[0]
            except queue.Empty:
                break
        
        if frames:
            return np.vstack(frames)
        return None
    
    def get_latest_buffer_data(self, n_samples=100) -> Optional[np.ndarray]:
        """Get latest data from circular buffer"""
        if len(self.raw_buffer) < n_samples:
            return None
        
        return np.array(list(self.raw_buffer)[-n_samples:])
    
    def start_prediction_collection(self, duration_seconds: float):
        """Start collecting data for prediction"""
        logger.info(f"📡 Starting prediction data collection for {duration_seconds}s")
        
        # Clear prediction queue
        while not self.prediction_queue.empty():
            try:
                self.prediction_queue.get_nowait()
            except queue.Empty:
                break
        
        # Set up collection
        self.prediction_active = True
        self.prediction_start_time = time.perf_counter()
        self.prediction_duration = duration_seconds
    
    def get_prediction_data(self) -> Optional[np.ndarray]:
        """Get collected prediction data"""
        self.prediction_active = False
        
        frames = []
        while not self.prediction_queue.empty():
            try:
                frame = self.prediction_queue.get_nowait()
                frames.append(frame.data)
            except queue.Empty:
                break
        
        if frames:
            result = np.vstack(frames)
            logger.info(f"📥 Retrieved prediction data: {result.shape}")
            return result
        
        return None
    
    def get_connection_stats(self) -> ConnectionStats:
        """Get comprehensive connection statistics"""
        channel_stats = self.get_channel_activity_stats()
        
        return ConnectionStats(
            connected=self.state in [ConnectionState.CONNECTED, ConnectionState.STREAMING],
            streaming=self.state == ConnectionState.STREAMING,
            total_frames_parsed=self.total_frames_parsed,
            parse_success_rate=self.parse_success_rate,
            sync_losses=self.sync_losses,
            current_fps=self.current_fps,
            current_throughput_mbps=self.current_throughput_mbps,
            total_bytes_received=self.total_bytes_received,
            buffer_size=len(self.frame_buffer),
            queue_sizes={
                'data': self.data_queue.qsize(),
                'monitor': self.monitor_queue.qsize(),
                'prediction': self.prediction_queue.qsize()
            },
            last_data_time=self.last_data_time,
            connection_stable=time.perf_counter() - self.last_data_time < 1.0 if self.last_data_time > 0 else False,
            channel_activity=channel_stats
        )
    
    def get_channel_activity_stats(self, recent_samples=100) -> Optional[Dict[str, Any]]:
        """Get channel activity statistics"""
        if len(self.raw_buffer) < recent_samples:
            return None
        
        # Get recent data
        recent_data = np.array(list(self.raw_buffer)[-recent_samples:])
        
        # Calculate per-channel statistics
        channel_power = np.var(recent_data, axis=0)
        channel_mean = np.mean(recent_data, axis=0)
        channel_std = np.std(recent_data, axis=0)
        
        # Detect active channels
        noise_floor = np.median(channel_power)
        active_threshold = noise_floor * 3.0
        active_channels = np.where(channel_power > active_threshold)[0]
        
        return {
            'total_channels': recent_data.shape[1],
            'active_channels': active_channels.tolist(),
            'n_active_channels': len(active_channels),
            'channel_power': channel_power.tolist(),
            'channel_mean': channel_mean.tolist(),
            'channel_std': channel_std.tolist(),
            'noise_floor': float(noise_floor),
            'active_threshold': float(active_threshold),
            'max_channel_power': float(np.max(channel_power)),
            'min_channel_power': float(np.min(channel_power))
        }
    
    def disconnect(self):
        """Disconnect and cleanup"""
        logger.info("🔌 Disconnecting MEG connection...")
        
        self.running = False
        
        # Wait for threads
        if self.stream_thread and self.stream_thread.is_alive():
            self.stream_thread.join(timeout=2.0)
        
        if self.processing_thread and self.processing_thread.is_alive():
            self.processing_thread.join(timeout=1.0)
        
        # Close socket
        if self.socket:
            try:
                self.socket.close()
            except:
                pass
        
        self._set_state(ConnectionState.DISCONNECTED)
        
        # Final stats
        logger.info(f"📊 Final Statistics:")
        logger.info(f"   Total frames: {self.total_frames_parsed}")
        logger.info(f"   Parse success: {self.parse_success_rate:.1f}%")
        logger.info(f"   Sync losses: {self.sync_losses}")
        logger.info(f"   Total data: {self.total_bytes_received / 1024 / 1024:.1f} MB")


# New class for Sensor Status Connection
@dataclass
class SensorStatus:
    """Data class for parsed sensor status information."""
    frame_number: int
    payload_size_from_header_field: int # The 38400 value
    num_sensors: int # The 64 value
    actual_payload_size_for_status: int # The 600 value
    status_strings: str
    status_values_raw_hex: str
    parsed_sensor_statuses: Dict[int, Dict[str, int]]
    timestamp: float

class MEGSensorStatusConnection:
    """
    Handles connection to N1 Sensor Status Port (8090) and parses status frames.
    """
    def __init__(self, host='192.168.0.10', port=8090):
        self.host = host
        self.port = port
        self.socket = None
        self.state = ConnectionState.DISCONNECTED
        self.latest_sensor_statuses: Optional[SensorStatus] = None
        
        # Frame structure constants based on debug_status_parser.py findings
        self.FRAME_START_MARKER = b'KCLB'
        self.PAYLOAD_END_MARKER = b'DNEB'
        self.FRAME_END_MARKER = b'KCLB'
        self.HEADER_SIZE = 20
        self.FOOTER_SIZE = 12
        self.EXPECTED_TOTAL_BYTES = 600 # Expected size of the status payload (strings + values)
        self.EXPECTED_NUM_SENSORS = 64
        
        self.frame_buffer = b''
        self.max_buffer_size = 100000 # 100KB max buffer
        self.buffer_size = 65536 # Receive buffer size
        
        self.stream_thread = None
        self.running = False
        self.consecutive_errors = 0
        
        logger.info(f"🔧 MEG Sensor Status Connection initialized")
        logger.info(f"   Target: {self.host}:{self.port}")

    def _set_state(self, new_state: ConnectionState):
        """Set connection state and notify callbacks (if any)"""
        if self.state != new_state:
            old_state = self.state
            self.state = new_state
            logger.info(f"🔄 Sensor Status State change: {old_state.value} → {new_state.value}")

    def connect_and_stream(self) -> bool:
        """Establish connection and start streaming sensor status"""
        if self.state in [ConnectionState.CONNECTED, ConnectionState.STREAMING]:
            logger.warning("Sensor Status: Already connected")
            return True
        
        try:
            self._set_state(ConnectionState.CONNECTING)
            logger.info(f"🔗 Sensor Status: Connecting to {self.host}:{self.port}")
            
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 1024*1024)
            self.socket.settimeout(10.0)
            self.socket.connect((self.host, self.port))
            self._set_state(ConnectionState.CONNECTED)
            
            self.running = True
            self.stream_thread = threading.Thread(target=self._high_performance_stream, daemon=True)
            self.stream_thread.start()
            
            self._set_state(ConnectionState.STREAMING)
            logger.info("✅ Sensor Status: Connected and streaming started")
            return True
            
        except Exception as e:
            logger.error(f"❌ Sensor Status: Connection failed: {e}")
            self._set_state(ConnectionState.ERROR)
            return False

    def _high_performance_stream(self):
        """High-performance streaming thread for sensor status"""
        logger.info("🔄 Sensor Status: Starting high-performance streaming")
        
        consecutive_empty_reads = 0
        
        while self.running and self.state in [ConnectionState.CONNECTED, ConnectionState.STREAMING]:
            try:
                self.socket.settimeout(0.1)
                data_chunk = self.socket.recv(self.buffer_size)
                
                if not data_chunk:
                    consecutive_empty_reads += 1
                    if consecutive_empty_reads > 50:
                        logger.error("❌ Sensor Status: Too many empty reads, connection may be lost")
                        self._set_state(ConnectionState.ERROR)
                        break
                    continue
                
                consecutive_empty_reads = 0
                self.frame_buffer += data_chunk
                
                self._process_status_frame_buffer()
                
            except socket.timeout:
                continue
            except Exception as e:
                self.consecutive_errors += 1
                if self.consecutive_errors > 10:
                    logger.error(f"❌ Sensor Status: Too many consecutive errors: {e}")
                    self._set_state(ConnectionState.ERROR)
                    break
                logger.debug(f"Sensor Status Stream error: {e}")
                time.sleep(0.01)
        
        self._set_state(ConnectionState.DISCONNECTED)
        logger.info("🔄 Sensor Status: High-performance streaming stopped")

    def _process_status_frame_buffer(self):
        """Process sensor status frames from buffer"""
        while True:
            if len(self.frame_buffer) < self.HEADER_SIZE:
                break # Not enough data for header

            header_values = struct.unpack('<5I', self.frame_buffer[:self.HEADER_SIZE])
            frame_start_marker_int_from_header = header_values[0]
            frame_number = header_values[1]
            payload_size_from_header_field = header_values[2] # The 38400 value
            num_sensors_in_frame = header_values[3] # The 64 value
            actual_payload_size_for_status = header_values[4] # The 600 value

            # Calculate full frame size using the total payload size from header_values[2]
            full_frame_size = self.HEADER_SIZE + payload_size_from_header_field + self.FOOTER_SIZE

            if len(self.frame_buffer) < full_frame_size:
                # print(f"DEBUG: Sensor Status: Current buffer size: {len(self.frame_buffer)}, Need: {full_frame_size}. Waiting for more data...")
                break # Not enough data for full frame

            frame_data = self.frame_buffer[:full_frame_size]

            try:
                # Validate frame start
                received_frame_start_bytes = frame_data[:4]
                if received_frame_start_bytes != self.FRAME_START_MARKER:
                    raise ValueError(f"Frame start mismatch: {received_frame_start_bytes.hex()}")

                # Validate header values
                if (struct.pack('<I', frame_start_marker_int_from_header) != self.FRAME_START_MARKER or
                    num_sensors_in_frame != self.EXPECTED_NUM_SENSORS):
                    raise ValueError(f"Header validation failed: {header_values}")

                # Extract payload using the total payload size from header_values[2]
                payload_bytes = frame_data[self.HEADER_SIZE : self.HEADER_SIZE + payload_size_from_header_field]

                # Validate footer
                footer_start = self.HEADER_SIZE + payload_size_from_header_field
                footer_data = frame_data[footer_start : footer_start + self.FOOTER_SIZE]
                
                if len(footer_data) < self.FOOTER_SIZE:
                    raise ValueError("Incomplete status footer.")

                payload_end_marker = footer_data[0:4]
                frame_end_marker = footer_data[8:12]

                if payload_end_marker != self.PAYLOAD_END_MARKER or frame_end_marker != self.FRAME_END_MARKER:
                    raise ValueError(f"Footer mismatch: {payload_end_marker.hex()} (expected {self.PAYLOAD_END_MARKER.hex()}), {frame_end_marker.hex()} (expected {self.FRAME_END_MARKER.hex()})")

                # --- Parse the 600-byte Status Payload ---
                # This assumes the 600 bytes are at the beginning of the 38400-byte payload
                status_strings_bytes = payload_bytes[0:300]
                status_strings = status_strings_bytes.decode('utf-8', errors='ignore')

                status_values_bytes = payload_bytes[300:600]
                
                sensor_statuses = {}
                for i in range(self.EXPECTED_NUM_SENSORS): # 64 sensors
                    offset = i * 4 # Assuming 4 bytes per sensor for ACT, LLS, SLS, FLS
                    if offset + 4 <= len(status_values_bytes):
                        sensor_data = status_values_bytes[offset : offset + 4]
                        act, lls, sls, fls = struct.unpack('<4B', sensor_data)
                        sensor_statuses[i] = {
                            'ACT': act,
                            'LLS': lls,
                            'SLS': sls,
                            'FLS': fls
                        }
                    else:
                        logger.warning(f"Sensor Status: Not enough bytes for sensor {i} status")
                        break

                self.latest_sensor_statuses = SensorStatus(
                    frame_number=frame_number,
                    payload_size_from_header_field=payload_size_from_header_field,
                    num_sensors=num_sensors_in_frame,
                    actual_payload_size_for_status=actual_payload_size_for_status,
                    status_strings=status_strings,
                    status_values_raw_hex=status_values_bytes.hex(),
                    parsed_sensor_statuses=sensor_statuses,
                    timestamp=time.time()
                )
                logger.debug(f"Sensor Status: Parsed frame {frame_number}")

                # Remove the parsed frame from the buffer
                self.frame_buffer = self.frame_buffer[full_frame_size:]
                self.consecutive_errors = 0

            except Exception as e:
                logger.error(f"Sensor Status: Error parsing frame: {e}")
                # Find next sync position to resync buffer
                sync_pos = self.frame_buffer.find(self.FRAME_START_MARKER, 1)
                if sync_pos != -1:
                    self.frame_buffer = self.frame_buffer[sync_pos:]
                    logger.warning(f"Sensor Status: Resyncing buffer, discarding {sync_pos} bytes.")
                else:
                    self.frame_buffer = b'' # Clear buffer if no sync found
                    logger.warning("Sensor Status: No sync found, clearing buffer.")
                self.consecutive_errors += 1
                if self.consecutive_errors > 10:
                    logger.error("Sensor Status: Too many consecutive parsing errors, stopping stream.")
                    self._set_state(ConnectionState.ERROR)
                    break
                break # Break from while loop to get more data

    def get_latest_sensor_statuses(self) -> Optional[SensorStatus]:
        """Returns the latest parsed sensor status data."""
        return self.latest_sensor_statuses

    def disconnect(self):
        """Disconnect and cleanup"""
        logger.info("🔌 Disconnecting Sensor Status connection...")
        self.running = False
        if self.stream_thread and self.stream_thread.is_alive():
            self.stream_thread.join(timeout=2.0)
        if self.socket:
            try:
                self.socket.close()
            except:
                pass
        self._set_state(ConnectionState.DISCONNECTED)
        logger.info("Sensor Status: Disconnected.")


# Factory function for backward compatibility
def create_meg_connection(host='192.168.0.10', port=8089, **kwargs) -> EnhancedMEGConnection:
    """Factory function to create MEG connection"""
    logger.info("🚀 Creating enhanced MEG connection")
    return EnhancedMEGConnection(host=host, port=port, **kwargs)
