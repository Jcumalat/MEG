# Placeholder for system routes
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel # Import BaseModel
from typing import Optional, Dict # Import Optional and Dict
from meg_chatgpt_bci.core.meg_connection import EnhancedMEGConnection, MEGSensorStatusConnection, SensorStatus # Import new classes
from meg_chatgpt_bci.core.n1_commander import N1Commander # Import N1Commander
from meg_chatgpt_bci.backend.schemas.system_config import SystemConfig, MEGConfig, SignalProcessingConfig, PhantomConfig, SystemHealth, MEGConnectionStatus

router = APIRouter(prefix="/api/system", tags=["System"])

# Global instance for MEGSensorStatusConnection, to be set by main.py
_sensor_status_connection: Optional[MEGSensorStatusConnection] = None
# Global instance for N1Commander, to be set by main.py
_n1_commander: Optional[N1Commander] = None

def set_sensor_status_connection(conn: MEGSensorStatusConnection):
    """Sets the MEGSensorStatusConnection instance for this router."""
    global _sensor_status_connection
    _sensor_status_connection = conn
    print(f"DEBUG: _sensor_status_connection set to: {_sensor_status_connection}")

def set_n1_commander(commander: N1Commander):
    """Sets the N1Commander instance for this router."""
    global _n1_commander
    _n1_commander = commander
    print(f"DEBUG: _n1_commander set to: {_n1_commander}")

class N1CommandRequest(BaseModel):
    component: str
    command: str
    param1: Optional[str] = ""
    param2: Optional[str] = ""

@router.get("/health")
async def get_system_health():
    return {"status": "healthy"}

@router.get("/metrics")
async def get_system_metrics():
    # Placeholder for system metrics
    return {"cpu_usage": 0.5, "memory_usage": 0.6}

@router.get("/status", response_model=SystemHealth) # Specify response model
async def get_system_status():
    """
    Returns the current system status, including MEG connection health.
    """
    meg_conn = EnhancedMEGConnection()
    try:
        connection_successful = await meg_conn.test_connection_async()
        meg_status = MEGConnectionStatus.HEALTHY if connection_successful else MEGConnectionStatus.DISCONNECTED
    except Exception:
        meg_status = MEGConnectionStatus.DISCONNECTED # Assume disconnected on error

    return SystemHealth(megConnection=meg_status, status="operational") # Return SystemHealth object

@router.get("/config", response_model=SystemConfig)
async def get_config():
    """Get current system configuration"""
    return SystemConfig(
        meg=MEGConfig(),
        signalProcessing=SignalProcessingConfig(),
        phantom=PhantomConfig()
    )

@router.put("/config")
async def update_config(config: SystemConfig):
    """Update system configuration"""
    # In a real application, you would save this config persistently
    # For now, we just acknowledge it.
    return {"message": "Configuration updated successfully", "config": config.dict()}

@router.post("/test-meg-connection")
async def test_meg_connection_endpoint():
    """
    Tests the connection to the MEG system.
    """
    meg_conn = EnhancedMEGConnection()
    try:
        connection_successful = await meg_conn.test_connection_async() # Await the async version
        if connection_successful:
            return {"status": "success", "message": "MEG connection test successful."}
        else:
            raise HTTPException(status_code=500, detail="MEG connection test failed: No valid frames found or connection issues.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during MEG connection test: {str(e)}")

@router.post("/command")
async def send_n1_command(request: N1CommandRequest):
    """
    Sends a command to the N1 MEG system.
    """
    if not _n1_commander:
        raise HTTPException(status_code=503, detail="N1 Commander not initialized.")
    success = _n1_commander.send_command(
        request.component,
        request.command,
        request.param1,
        request.param2
    )
    if success:
        return {"message": "Command sent successfully", "command": request.dict()}
    else:
        raise HTTPException(status_code=500, detail="Failed to send command to N1 system.")

@router.post("/sensors/activate_all")
async def activate_all_sensors_endpoint():
    """
    Sends the 'Activate All' command to the N1 MEG system.
    """
    if not _n1_commander:
        raise HTTPException(status_code=503, detail="N1 Commander not initialized.")
    success = _n1_commander.send_command("Sensor", "Activate All")
    if success:
        return {"message": "Activate All command sent successfully."}
    else:
        raise HTTPException(status_code=500, detail="Failed to send 'Activate All' command to N1 system.")

@router.post("/sensors/deactivate_all")
async def deactivate_all_sensors_endpoint():
    """
    Sends the 'Deactivate All' command to the N1 MEG system.
    """
    if not _n1_commander:
        raise HTTPException(status_code=503, detail="N1 Commander not initialized.")
    success = _n1_commander.send_command("Sensor", "Deactivate All")
    if success:
        return {"message": "Deactivate All command sent successfully."}
    else:
        raise HTTPException(status_code=500, detail="Failed to send 'Deactivate All' command to N1 system.")

@router.post("/sensors/{sensor_id}/toggle_stream")
async def toggle_sensor_stream_endpoint(sensor_id: int, activate: bool):
    """
    Activates or deactivates a single sensor's stream.
    """
    if not _n1_commander:
        raise HTTPException(status_code=503, detail="N1 Commander not initialized.")
    
    command = "Activate Sensor" if activate else "Deactivate Sensor"
    success = _n1_commander.send_command("Sensor", command, str(sensor_id))
    
    if success:
        return {"message": f"Sensor {sensor_id} {command.lower()} command sent successfully."}
    else:
        raise HTTPException(status_code=500, detail=f"Failed to send {command} command for sensor {sensor_id} to N1 system.")

@router.get("/test-route")
async def test_route():
    return {"message": "Test route successful!"}

@router.get("/sensor_status", response_model=SensorStatus)
async def get_sensor_status():
    """
    Returns the latest sensor status data from the MEGSensorStatusConnection.
    """
    print(f"DEBUG: get_sensor_status called. _sensor_status_connection is: {_sensor_status_connection}")
    if not _sensor_status_connection:
        raise HTTPException(status_code=503, detail="Sensor status connection not initialized.")
    
    latest_status = _sensor_status_connection.get_latest_sensor_statuses()
    if not latest_status:
        raise HTTPException(status_code=404, detail="No sensor status data available yet.")
    
    print(f"DEBUG: Returning sensor status: {latest_status}")
    return latest_status
