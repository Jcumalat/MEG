"""
MEG Connection API endpoints
Handles MEG system connection, testing, and data streaming
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import asyncio
import logging
from datetime import datetime
import sys
import io
import struct
import numpy as np
import socket # Added import
import time   # Added import

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse

from meg_chatgpt_bci.core.meg_connection import EnhancedMEGConnection, ConnectionState
from meg_chatgpt_bci.core.phantom_controller import PhantomController

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/meg", tags=["MEG Connection"])

# Global MEG connection instance, to be set by main.py
_meg_connection: Optional[EnhancedMEGConnection] = None
phantom_controller: Optional[PhantomController] = None

def set_meg_connection(conn: EnhancedMEGConnection):
    """Sets the EnhancedMEGConnection instance for this router."""
    global _meg_connection
    _meg_connection = conn
    logger.info(f"DEBUG: _meg_connection set to: {_meg_connection}")


class MEGConnectionConfig(BaseModel):
    host: str = "192.168.0.10"
    port: int = 8089
    samplingRate: int = 375
    channels: int = 192
    timeout: int = 10000


class MEGConnectionStatus(BaseModel):
    isConnected: bool
    connectionType: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    samplingRate: Optional[int] = None
    channels: Optional[int] = None
    lastUpdate: Optional[str] = None
    throughput: Optional[float] = None
    frameRate: Optional[float] = None
    quality: Optional[str] = None
    state: str
    stats: Optional[Dict[str, Any]] = None


class MEGTestResult(BaseModel):
    success: bool
    message: str
    connectionTime: Optional[float] = None
    throughput: Optional[float] = None
    framesFound: Optional[int] = None
    # Removed details as it's redundant if framesFound and throughput are direct properties


@router.get("/status", response_model=MEGConnectionStatus)
async def get_meg_status():
    """Get current MEG connection status"""
    global _meg_connection
    
    if not _meg_connection:
        return MEGConnectionStatus(
            isConnected=False,
            state="disconnected"
        )
    
    try:
        stats = _meg_connection.get_connection_stats()
        
        # Determine quality based on connection stats
        quality = "excellent"
        if not stats.connection_stable:
            quality = "poor"
        elif stats.parse_success_rate < 90:
            quality = "fair"
        elif stats.parse_success_rate < 95:
            quality = "good"
        
        return MEGConnectionStatus(
            isConnected=stats.connected,
            connectionType="TCP",
            host=_meg_connection.host,
            port=_meg_connection.port,
            samplingRate=_meg_connection.sampling_rate,
            channels=_meg_connection.n_channels,
            lastUpdate=datetime.fromtimestamp(stats.last_data_time).isoformat() if stats.last_data_time > 0 else None,
            throughput=stats.current_throughput_mbps,
            frameRate=stats.current_fps,
            quality=quality,
            state=_meg_connection.state.value,
            stats=stats.__dict__
        )
        
    except Exception as e:
        logger.error(f"Error getting MEG status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/connect")
async def connect_meg(config: MEGConnectionConfig):
    """Connect to MEG system"""
    global _meg_connection
    
    if not _meg_connection:
        logger.error("MEG connection instance not initialized in backend lifespan.")
        raise HTTPException(status_code=500, detail="MEG connection instance not initialized in backend lifespan.")

    try:
        logger.info(f"Attempting to connect MEG with config: {config.dict()}")
        # Update host/port if changed (though ideally this is set once in lifespan)
        _meg_connection.host = config.host
        _meg_connection.port = config.port
        _meg_connection.sampling_rate = config.samplingRate # Ensure sampling rate is updated
        _meg_connection.n_channels = config.channels # Ensure channels is updated

        # Connect and start streaming
        success = _meg_connection.connect_and_stream()
        
        if success:
            logger.info("MEG connection established successfully via /connect endpoint.")
            return {"message": "MEG connection established successfully", "success": True}
        else:
            logger.error("Failed to connect to MEG system via _meg_connection.connect_and_stream().")
            raise HTTPException(status_code=400, detail="Failed to connect to MEG system")
            
    except Exception as e:
        logger.error(f"Exception in /connect endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An error occurred during MEG connection: {str(e)}")


@router.post("/disconnect")
async def disconnect_meg():
    """Disconnect from MEG system"""
    global _meg_connection
    
    try:
        if _meg_connection:
            _meg_connection.disconnect()
            return {"message": "MEG connection closed successfully", "success": True}
        else:
            return {"message": "No active MEG connection", "success": True}
            
    except Exception as e:
        logger.error(f"Error disconnecting MEG: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test", response_model=MEGTestResult)
async def test_meg_connection(config: MEGConnectionConfig):
    """Test MEG connection without establishing persistent connection"""
    try:
        # Create temporary connection for testing
        test_connection = EnhancedMEGConnection(
            host=config.host,
            port=config.port
        )
        
        # Run async test and capture results
        test_result = await test_connection.test_connection_async(timeout=config.timeout / 1000)
        
        if test_result: # test_connection_async now returns a dict with results
            return MEGTestResult(
                success=True,
                message="MEG connection test successful",
                framesFound=test_result.get('frames_found'),
                throughput=test_result.get('throughput_mbps')
            )
        else:
            return MEGTestResult(
                success=False,
                message="MEG connection test failed - no valid frames found"
            )
            
    except Exception as e:
        logger.error(f"Error testing MEG connection: {e}")
        return MEGTestResult(
            success=False,
            message=f"MEG connection test failed: {str(e)}"
        )


@router.get("/data/monitor")
async def get_monitor_data(max_samples: int = 2000): # Increased max_samples for better visualization
    """Get recent MEG data for monitoring/visualization"""
    global _meg_connection
    
    if not _meg_connection:
        raise HTTPException(status_code=400, detail="No MEG connection available")
    
    try:
        data = _meg_connection.get_monitor_data(max_samples=max_samples)
        
        if data is not None:
            return {
                "data": data.tolist(),
                "shape": data.shape,
                "timestamp": datetime.now().isoformat(),
                "samplingRate": _meg_connection.sampling_rate,
                "channels": _meg_connection.n_channels
            }
        else:
            return {
                "data": None,
                "message": "No data available"
            }
            
    except Exception as e:
        logger.error(f"Error getting monitor data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data/latest")
async def get_latest_data(n_samples: int = 100):
    """Get latest data from circular buffer"""
    global _meg_connection
    
    if not _meg_connection:
        raise HTTPException(status_code=400, detail="No MEG connection available")
    
    try:
        data = _meg_connection.get_latest_buffer_data(n_samples=n_samples)
        
        if data is not None:
            return {
                "data": data.tolist(),
                "shape": data.shape,
                "timestamp": datetime.now().isoformat(),
                "samplingRate": _meg_connection.sampling_rate,
                "channels": _meg_connection.n_channels
            }
        else:
            return {
                "data": None,
                "message": "Insufficient data in buffer"
            }
            
    except Exception as e:
        logger.error(f"Error getting latest data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data/prediction/start")
async def start_prediction_collection(duration: float = 3.0):
    """Start collecting data for prediction"""
    global _meg_connection
    
    if not _meg_connection:
        raise HTTPException(status_code=400, detail="No MEG connection available")
    
    try:
        _meg_connection.start_prediction_collection(duration)
        return {
            "message": f"Started prediction data collection for {duration} seconds",
            "duration": duration,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error starting prediction collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data/prediction")
async def get_prediction_data():
    """Get collected prediction data"""
    global _meg_connection
    
    if not _meg_connection:
        raise HTTPException(status_code=400, detail="No MEG connection available")
    
    try:
        data = _meg_connection.get_prediction_data()
        
        if data is not None:
            return {
                "data": data.tolist(),
                "shape": data.shape,
                "timestamp": datetime.now().isoformat(),
                "samplingRate": _meg_connection.sampling_rate,
                "channels": _meg_connection.n_channels
            }
        else:
            return {
                "data": None,
                "message": "No prediction data collected"
            }
            
    except Exception as e:
        logger.error(f"Error getting prediction data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/channels/activity")
async def get_channel_activity():
    """Get channel activity statistics"""
    global _meg_connection
    
    if not _meg_connection:
        raise HTTPException(status_code=400, detail="No MEG connection available")
    
    try:
        stats = _meg_connection.get_channel_activity_stats()
        
        if stats:
            return {
                "channelActivity": stats,
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "channelActivity": None,
                "message": "Insufficient data for channel analysis"
            }
            
    except Exception as e:
        logger.error(f"Error getting channel activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/phantom/status")
async def get_phantom_status():
    """Get phantom controller status"""
    global phantom_controller
    
    if not phantom_controller:
        return {
            "isActive": False,
            "message": "Phantom controller not initialized"
        }
    
    try:
        return {
            "isActive": phantom_controller.is_active,
            "frequency": phantom_controller.frequency,
            "amplitude": phantom_controller.amplitude,
            "waveform": phantom_controller.waveform,
            "channels": phantom_controller.target_channels
        }
        
    except Exception as e:
        logger.error(f"Error getting phantom status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/phantom/start")
async def start_phantom(
    frequency: float = 10.0,
    amplitude: float = 1.0,
    duration: float = 5.0,
    channels: List[int] = [1, 2, 3, 4],
    waveform: str = "sine"
):
    """Start phantom signal generation"""
    global phantom_controller
    
    try:
        if not phantom_controller:
            phantom_controller = PhantomController()
        
        phantom_controller.configure(
            frequency=frequency,
            amplitude=amplitude,
            waveform=waveform,
            target_channels=channels
        )
        
        phantom_controller.start_signal(duration=duration)
        
        return {
            "message": f"Phantom signal started for {duration} seconds",
            "frequency": frequency,
            "amplitude": amplitude,
            "waveform": waveform,
            "channels": channels,
            "duration": duration
        }
        
    except Exception as e:
        logger.error(f"Error starting phantom signal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/phantom/stop")
async def stop_phantom():
    """Stop phantom signal generation"""
    global phantom_controller
    
    try:
        if phantom_controller:
            phantom_controller.stop_signal()
            return {"message": "Phantom signal stopped"}
        else:
            return {"message": "No active phantom signal"}
            
    except Exception as e:
        logger.error(f"Error stopping phantom signal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Callback functions for MEG connection events
def on_meg_data_received(data, frame):
    """Callback for new MEG data"""
    # This could be used for real-time processing or WebSocket broadcasting
    pass


def on_meg_error(error):
    """Callback for MEG connection errors"""
    logger.error(f"MEG connection error: {error}")


def on_meg_status_change(state: ConnectionState):
    """Callback for MEG connection status changes"""
    logger.info(f"MEG connection state changed to: {state.value}")


# Initialize callbacks when connection is created
@router.post("/debug_stream_test")
async def debug_stream_test(config: MEGConnectionConfig, background_tasks: BackgroundTasks):
    """
    Run MEG data stream debug analysis and stream output.
    This will connect to the MEG system, collect data, and analyze its structure,
    streaming the analysis output back to the client.
    """
    
    async def generate_output():
        old_stdout = sys.stdout
        redirected_output = io.StringIO()
        sys.stdout = redirected_output
        
        try:
            # Run the analysis function
            await asyncio.to_thread(analyze_meg_stream_fastapi, config.host, config.port, config.timeout / 1000)
            
            # Stream the captured output
            output_lines = redirected_output.getvalue().splitlines(keepends=True)
            for line in output_lines:
                yield line
                await asyncio.sleep(0.01) # Small delay to allow client to catch up
                
        except Exception as e:
            logger.error(f"Error during debug stream test: {e}")
            yield f"ERROR: {str(e)}\n"
        finally:
            sys.stdout = old_stdout # Restore stdout
            redirected_output.close()

    return StreamingResponse(generate_output(), media_type="text/plain")


def analyze_meg_stream_fastapi(host: str, port: int, duration: float):
    """Analyze MEG data stream with corrected frame parsing, adapted for FastAPI"""
    
    print(f"🔍 FIXED MEG Stream Debug Analyzer")
    print(f"Target: {host}:{port}")
    print(f"Duration: {duration} seconds")
    print("FIXED: Now correctly distinguishes frame start vs frame end KCLB markers")
    print("=" * 70)
    
    all_data = b''
    
    try:
        print(f"📡 Connecting to {host}:{port}...")
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(duration) # Use duration as timeout for initial connect
        sock.connect((host, port))
        print("✅ Connected successfully!")
        
        start_time = time.time()
        chunk_count = 0
        
        print(f"📊 Collecting data for {duration} seconds...")
        
        while time.time() - start_time < duration:
            try:
                sock.settimeout(1.0) # Shorter timeout for recv chunks
                chunk = sock.recv(8192)
                if chunk:
                    all_data += chunk
                    chunk_count += 1
                    if chunk_count % 50 == 0:
                        print(f"   Received {len(all_data)} bytes in {chunk_count} chunks")
                else:
                    print("⚠️ Empty chunk received")
                    break # No more data
            except socket.timeout:
                print("⚠️ Socket timeout - continuing...")
                continue
            except Exception as e:
                print(f"❌ Error receiving data: {e}")
                break
        
        sock.close()
        
        print(f"✅ Data collection complete!")
        print(f"   Total bytes: {len(all_data)}")
        print(f"   Total chunks: {chunk_count}")
        
    except Exception as e:
        print(f"❌ Connection error: {e}")
        print("💡 Using known pattern for analysis...")
        analyze_with_known_pattern() # Call directly, no return needed for streaming
        return
    
    if len(all_data) == 0:
        print("❌ No data collected!")
        analyze_with_known_pattern()
        return
    
    print("")
    
    analyze_frame_structure_corrected(all_data)


def analyze_frame_structure_corrected(data):
    """FIXED: Correctly identify frame boundaries and distinguish start/end markers"""
    
    print("🔍 FIXED FRAME STRUCTURE ANALYSIS")
    print("=" * 50)
    
    all_kclb_positions = find_all_occurrences(data, b'KCLB')
    all_dneb_positions = find_all_occurrences(data, b'DNEB')
    
    print(f"📊 Raw Marker Analysis:")
    print(f"   Total KCLB markers: {len(all_kclb_positions)}")
    print(f"   Total DNEB markers: {len(all_dneb_positions)}")
    
    if len(all_kclb_positions) > 10:
        print(f"   First 10 KCLB: {all_kclb_positions[:10]}")
    if len(all_dneb_positions) > 5:
        print(f"   First 5 DNEB: {all_dneb_positions[:5]}")
    
    print("")
    
    real_frame_starts = identify_real_frame_starts(data, all_kclb_positions)
    
    print(f"🎯 FIXED Frame Identification:")
    print(f"   Real frame starts: {len(real_frame_starts)}")
    print(f"   Frame end markers: {len(all_kclb_positions) - len(real_frame_starts)}")
    
    if len(real_frame_starts) > 5:
        print(f"   Frame start positions: {real_frame_starts[:5]}")
    
    if len(real_frame_starts) > 1:
        frame_gaps = [real_frame_starts[i+1] - real_frame_starts[i] 
                      for i in range(min(5, len(real_frame_starts)-1))]
        print(f"   Frame spacing: {frame_gaps}")
        
        if frame_gaps:
            common_spacing = max(set(frame_gaps), key=frame_gaps.count)
            print(f"   Common frame size: {common_spacing} bytes")
    
    print("")
    
    if real_frame_starts:
        analyze_correct_frames(data, real_frame_starts, all_dneb_positions)
    else:
        print("❌ No valid frame starts identified")


def identify_real_frame_starts(data, kclb_positions):
    """FIXED: Identify which KCLB markers are real frame starts vs frame ends"""
    
    real_starts = []
    
    for pos in kclb_positions:
        if pos + 20 > len(data):
            continue
        
        try:
            header_data = data[pos:pos + 20]
            header_values = struct.unpack('<5I', header_data)
            
            frame_start_marker = header_values[0]
            frame_number = header_values[1]
            payload_size = header_values[2]
            n_sensors = header_values[3]
            acquisition_rate = header_values[4]
            
            valid_header = (
                frame_start_marker == 0x4b434c42 and # Corrected from BLCK to KCLB
                0 < payload_size < 100000 and
                0 < n_sensors < 500 and
                100 < acquisition_rate < 5000
            )
            
            if valid_header:
                expected_dneb_pos = pos + 20 + payload_size
                if (expected_dneb_pos + 4 <= len(data) and 
                    data[expected_dneb_pos:expected_dneb_pos + 4] == b'DNEB'):
                    real_starts.append(pos)
                    
        except (struct.error, IndexError):
            continue
    
    return real_starts


def analyze_correct_frames(data, frame_starts, dneb_positions):
    """FIXED: Analyze correctly identified frames"""
    
    print("🔍 ANALYZING CORRECTLY IDENTIFIED FRAMES:")
    
    successful_frames = 0
    frame_info = []
    
    for i, start_pos in enumerate(frame_starts[:5]):
        print(f"\n--- FIXED FRAME {i+1} at position {start_pos} ---")
        
        try:
            header_data = data[start_pos:start_pos + 20]
            header_values = struct.unpack('<5I', header_data)
            
            frame_start_marker = header_values[0]
            frame_number = header_values[1]
            payload_size = header_values[2]
            n_sensors = header_values[3]
            acquisition_rate = header_values[4]
            
            print(f"   📋 Header (20 bytes):")
            print(f"     Frame Start: 0x{frame_start_marker:08x} (KCLB)")
            print(f"     Frame Number: {frame_number}")
            print(f"     Payload Size: {payload_size} bytes")
            print(f"     Sensors: {n_sensors}")
            print(f"     Rate: {acquisition_rate} Hz")
            
            header_end = start_pos + 20
            payload_start = header_end
            payload_end = payload_start + payload_size
            dneb_pos = payload_end
            footer_start = dneb_pos
            footer_end = footer_start + 12
            
            print(f"   📐 Frame Layout:")
            print(f"     Header: {start_pos} to {header_end} (20 bytes)")
            print(f"     Payload: {payload_start} to {payload_end} ({payload_size} bytes)")
            print(f"     Footer: {footer_start} to {footer_end} (12 bytes)")
            print(f"     Total: {footer_end - start_pos} bytes")
            
            if footer_end <= len(data):
                footer_data = data[footer_start:footer_end]
                
                dneb_marker = footer_data[0:4]
                checksum = struct.unpack('<I', footer_data[4:8])[0]
                frame_end_marker = footer_data[8:12]
                
                print(f"   📝 Footer Analysis:")
                print(f"     DNEB: {dneb_marker} ({'✅' if dneb_marker == b'DNEB' else '❌'})")
                print(f"     Checksum: 0x{checksum:08x}")
                print(f"     End Marker: {frame_end_marker} ({'✅' if frame_end_marker == b'KCLB' else '❌'})")
                
                if dneb_marker == b'DNEB' and frame_end_marker == b'KCLB':
                    print(f"   ✅ PERFECT FRAME STRUCTURE!")
                    successful_frames += 1
                    
                    frame_info.append({
                        'start_pos': start_pos,
                        'frame_number': frame_number,
                        'payload_size': payload_size,
                        'n_sensors': n_sensors,
                        'rate': acquisition_rate,
                        'total_size': footer_end - start_pos
                    })
                    
                    if payload_size > 0:
                        payload_data = data[payload_start:payload_end]
                        analyze_payload_data(payload_data, payload_size, n_sensors)
                else:
                    print(f"   ❌ Footer validation failed")
            else:
                print(f"   ⚠️ Incomplete frame (extends beyond data)")
                
        except Exception as e:
            print(f"   ❌ Frame analysis error: {e}")
    
    print(f"\n📊 FIXED FRAME ANALYSIS SUMMARY:")
    print(f"   Frames analyzed: {len(frame_starts[:5])}")
    print(f"   Successfully parsed: {successful_frames}")
    print(f"   Success rate: {successful_frames/len(frame_starts[:5])*100:.1f}%")
    
    if frame_info:
        common_payload = max([f['payload_size'] for f in frame_info], 
                           key=[f['payload_size'] for f in frame_info].count)
        common_sensors = max([f['n_sensors'] for f in frame_info], 
                           key=[f['n_sensors'] for f in frame_info].count)
        common_rate = max([f['rate'] for f in frame_info], 
                         key=[f['rate'] for f in frame_info].count)
        
        print(f"\n🎯 DISCOVERED FRAME STRUCTURE:")
        print(f"   Header: 20 bytes (KCLB + Frame# + PayloadSize + Sensors + Rate)")
        print(f"   Payload: {common_payload} bytes")
        print(f"   Footer: 12 bytes (DNEB + Checksum + KCLB)")
        print(f"   Total: {20 + common_payload + 12} bytes")
        print(f"   Sensors: {common_sensors}")
        print(f"   Rate: {common_rate} Hz")
        
        if common_payload % 4 == 0:
            num_floats = common_payload // 4
            print(f"\n📊 PAYLOAD DATA STRUCTURE:")
            print(f"   Float count: {num_floats}")
            
            print(f"   Possible arrangements:")
            
            possible_structures = []
            for samples in [16, 32, 64, 85, 128, 256]:
                if num_floats % samples == 0:
                    channels = num_floats // samples
                    if channels <= 512:
                        possible_structures.append((samples, channels))
            
            def meg_score(structure):
                samples, channels = structure
                if 192 <= channels <= 256:
                    return 100
                elif 128 <= channels <= 300:
                    return 80
                elif 64 <= channels <= 400:
                    return 60
                else:
                    return 20
            
            possible_structures.sort(key=meg_score, reverse=True)
            
            for samples, channels in possible_structures[:6]:
                score = meg_score((samples, channels))
                emoji = "🎯" if score >= 100 else "✅" if score >= 80 else "👍" if score >= 60 else "📊"
                print(f"     {samples:3d} samples × {channels:3d} channels {emoji}")
                
                if channels % 3 == 0:
                    sensors = channels // 3
                    print(f"         → {sensors} sensors × 3 axes (X,Y,Z)")
                    if sensors == common_sensors:
                        print(f"         → ✅ MATCHES header sensor count!")
            
            print(f"\n💡 RECOMMENDED IMPLEMENTATION:")
            if possible_structures:
                best = possible_structures[0]
                print(f"   • Use structure: {best[0]} samples × {best[1]} channels")
                print(f"   • Header parsing: struct.unpack('<5I', header[:20])")
                print(f"   • Payload: {common_payload} bytes starting at offset 20")
                print(f"   • Footer: DNEB + checksum + KCLB at end")
                print(f"   • Total frame size: {20 + common_payload + 12} bytes")
                
                if best[1] % 3 == 0:
                    sensors = best[1] // 3
                    print(f"   • Physical sensors: {sensors} (each with X,Y,Z components)")
                
                frame_rate = common_rate / best[0] if best[0] > 0 else 0
                print(f"   • Frame rate: ~{frame_rate:.1f} Hz ({best[0]} samples at {common_rate} Hz)")


def analyze_payload_data(payload_data, payload_size, n_sensors):
    """Analyze the payload data structure"""
    print(f"   🔬 Payload Data Analysis:")
    
    try:
        num_floats = payload_size // 4
        float_array = np.frombuffer(payload_data, dtype='<f4')
        
        if len(float_array) != num_floats:
            print(f"     ❌ Float array length mismatch")
            return
        
        finite_mask = np.isfinite(float_array)
        finite_ratio = np.sum(finite_mask) / len(float_array)
        zero_mask = (float_array == 0)
        zero_ratio = np.sum(zero_mask) / len(float_array)
        
        print(f"     Float32 values: {num_floats}")
        print(f"     Data range: {np.min(float_array):.2e} to {np.max(float_array):.2e}")
        print(f"     Finite values: {finite_ratio*100:.1f}%")
        print(f"     Zero values: {zero_ratio*100:.1f}%")
        print(f"     Non-zero values: {(1-zero_ratio)*100:.1f}%")
        
        non_zero_data = float_array[~zero_mask & finite_mask]
        if len(non_zero_data) > 0:
            print(f"     Non-zero range: {np.min(non_zero_data):.2e} to {np.max(non_zero_data):.2e}")
            print(f"     Non-zero std: {np.std(non_zero_data):.2e}")
        
        expected_channels = n_sensors * 3
        if num_floats % expected_channels == 0:
            samples = num_floats // expected_channels
            print(f"     ✅ Perfect sensor fit: {samples} samples × {expected_channels} channels")
            print(f"       ({n_sensors} sensors × 3 axes each)")
        
    except Exception as e:
        print(f"     ❌ Payload analysis error: {e}")


def analyze_with_known_pattern():
    """Analyze using known successful pattern when connection fails"""
    
    print("\n🔍 ANALYZING KNOWN WORKING PATTERN")
    print("=" * 40)
    print("Based on successful debug runs:")
    print("")
    
    print("📊 Confirmed Frame Structure:")
    print("   Header: 20 bytes")
    print("     - KCLB (4 bytes)")
    print("     - Frame Number (4 bytes)")
    print("     - Payload Size (4 bytes)")  
    print("     - Number of Sensors (4 bytes)")
    print("     - Acquisition Rate (4 bytes)")
    print("")
    print("   Payload: 16384 bytes (4096 float32 values)")
    print("")
    print("   Footer: 12 bytes")
    print("     - DNEB (4 bytes)")
    print("     - Checksum (4 bytes)")
    print("     - KCLB (4 bytes)")
    print("")
    print("   Total Frame Size: 16416 bytes")
    print("")
    
    print("📊 Data Structure:")
    print("   4096 floats can be arranged as:")
    print("     16 samples × 256 channels 🎯")
    print("     32 samples × 128 channels ✅")  
    print("     64 samples × 64 channels 👍")
    print("")
    print("   For 64 sensors × 3 axes = 192 channels:")
    print("     21.33 samples (not exact fit)")
    print("   For 85.33 sensors × 3 axes = 256 channels:")
    print("     16 samples ✅ LIKELY STRUCTURE")
    print("")
    
    print("💡 IMPLEMENTATION RECOMMENDATIONS:")
    print("   • Frame detection: Search for KCLB followed by valid header")
    print("   • Header parsing: struct.unpack('<5I', data[pos:pos+20])")
    print("   • Validate: payload_size == 16384, sensors == 64, rate == 375")
    print("   • Data extraction: 16 samples × 256 channels (first 192 for MEG)")
    print("   • Frame boundaries: Every 16416 bytes")
    print("   • Footer validation: Check for DNEB...KCLB sequence")


def find_all_occurrences(data, pattern):
    """Find all occurrences of pattern in data"""
    positions = []
    start = 0
    while True:
        pos = data.find(pattern, start)
        if pos == -1:
            break
        positions.append(pos)
        start = pos + 1
    return positions


def setup_meg_callbacks():
    """Setup MEG connection callbacks"""
    global _meg_connection
    
    if _meg_connection:
        _meg_connection.add_data_callback(on_meg_data_received)
        _meg_connection.add_error_callback(on_meg_error)
        _meg_connection.add_status_callback(on_meg_status_change)
