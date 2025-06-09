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

from core.meg_connection import EnhancedMEGConnection, ConnectionState
from core.phantom_controller import PhantomController

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/meg", tags=["MEG Connection"])

# Global MEG connection instance
meg_connection: Optional[EnhancedMEGConnection] = None
phantom_controller: Optional[PhantomController] = None


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
    details: Optional[Dict[str, Any]] = None


@router.get("/status", response_model=MEGConnectionStatus)
async def get_meg_status():
    """Get current MEG connection status"""
    global meg_connection
    
    if not meg_connection:
        return MEGConnectionStatus(
            isConnected=False,
            state="disconnected"
        )
    
    try:
        stats = meg_connection.get_connection_stats()
        
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
            host=meg_connection.host,
            port=meg_connection.port,
            samplingRate=meg_connection.sampling_rate,
            channels=meg_connection.n_channels,
            lastUpdate=datetime.fromtimestamp(stats.last_data_time).isoformat() if stats.last_data_time > 0 else None,
            throughput=stats.current_throughput_mbps,
            frameRate=stats.current_fps,
            quality=quality,
            state=meg_connection.state.value,
            stats=stats.__dict__
        )
        
    except Exception as e:
        logger.error(f"Error getting MEG status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/connect")
async def connect_meg(config: MEGConnectionConfig):
    """Connect to MEG system"""
    global meg_connection
    
    try:
        # Create new connection if needed
        if not meg_connection or meg_connection.host != config.host or meg_connection.port != config.port:
            if meg_connection:
                meg_connection.disconnect()
            
            meg_connection = EnhancedMEGConnection(
                host=config.host,
                port=config.port
            )
        
        # Connect and start streaming
        success = meg_connection.connect_and_stream()
        
        if success:
            return {"message": "MEG connection established successfully", "success": True}
        else:
            raise HTTPException(status_code=400, detail="Failed to connect to MEG system")
            
    except Exception as e:
        logger.error(f"Error connecting to MEG: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/disconnect")
async def disconnect_meg():
    """Disconnect from MEG system"""
    global meg_connection
    
    try:
        if meg_connection:
            meg_connection.disconnect()
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
        
        # Run async test
        success = await test_connection.test_connection_async(timeout=config.timeout / 1000)
        
        if success:
            return MEGTestResult(
                success=True,
                message="MEG connection test successful",
                details={
                    "host": config.host,
                    "port": config.port,
                    "samplingRate": config.samplingRate,
                    "channels": config.channels
                }
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
async def get_monitor_data(max_samples: int = 100):
    """Get recent MEG data for monitoring/visualization"""
    global meg_connection
    
    if not meg_connection:
        raise HTTPException(status_code=400, detail="No MEG connection available")
    
    try:
        data = meg_connection.get_monitor_data(max_samples=max_samples)
        
        if data is not None:
            return {
                "data": data.tolist(),
                "shape": data.shape,
                "timestamp": datetime.now().isoformat(),
                "samplingRate": meg_connection.sampling_rate,
                "channels": meg_connection.n_channels
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
    global meg_connection
    
    if not meg_connection:
        raise HTTPException(status_code=400, detail="No MEG connection available")
    
    try:
        data = meg_connection.get_latest_buffer_data(n_samples=n_samples)
        
        if data is not None:
            return {
                "data": data.tolist(),
                "shape": data.shape,
                "timestamp": datetime.now().isoformat(),
                "samplingRate": meg_connection.sampling_rate,
                "channels": meg_connection.n_channels
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
    global meg_connection
    
    if not meg_connection:
        raise HTTPException(status_code=400, detail="No MEG connection available")
    
    try:
        meg_connection.start_prediction_collection(duration)
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
    global meg_connection
    
    if not meg_connection:
        raise HTTPException(status_code=400, detail="No MEG connection available")
    
    try:
        data = meg_connection.get_prediction_data()
        
        if data is not None:
            return {
                "data": data.tolist(),
                "shape": data.shape,
                "timestamp": datetime.now().isoformat(),
                "samplingRate": meg_connection.sampling_rate,
                "channels": meg_connection.n_channels
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
    global meg_connection
    
    if not meg_connection:
        raise HTTPException(status_code=400, detail="No MEG connection available")
    
    try:
        stats = meg_connection.get_channel_activity_stats()
        
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
def setup_meg_callbacks():
    """Setup MEG connection callbacks"""
    global meg_connection
    
    if meg_connection:
        meg_connection.add_data_callback(on_meg_data_received)
        meg_connection.add_error_callback(on_meg_error)
        meg_connection.add_status_callback(on_meg_status_change)
