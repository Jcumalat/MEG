"""
FastAPI main application entry point for MEG ChatGPT BCI system.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import logging
from typing import Optional

# Configure basic logging at the root level to capture important messages
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

from meg_chatgpt_bci.backend.api import meg, training_routes, inference_routes, system_routes, analysis_routes
from meg_chatgpt_bci.core.meg_connection import EnhancedMEGConnection, MEGSensorStatusConnection
from meg_chatgpt_bci.core.n1_commander import N1Commander

# Global instances for connections
sensor_status_connection: Optional[MEGSensorStatusConnection] = None
meg_data_connection: Optional[EnhancedMEGConnection] = None
n1_commander_instance: Optional[N1Commander] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown tasks."""
    # Startup
    print("Starting MEG ChatGPT BCI Backend...")
    global sensor_status_connection
    global meg_data_connection
    global n1_commander_instance

    # Initialize MEGSensorStatusConnection
    sensor_status_connection = MEGSensorStatusConnection()
    print(f"DEBUG: MEGSensorStatusConnection instance created: {sensor_status_connection}")
    if not sensor_status_connection.connect_and_stream():
        print("Failed to connect to MEG Sensor Status stream!")
    print(f"DEBUG: MEGSensorStatusConnection state after connect_and_stream: {sensor_status_connection.state.value}")
    system_routes.set_sensor_status_connection(sensor_status_connection)

    # Initialize EnhancedMEGConnection
    meg_data_connection = EnhancedMEGConnection()
    print(f"DEBUG: EnhancedMEGConnection instance created: {meg_data_connection}")
    # Note: We don't call connect_and_stream here, it's triggered by the /connect endpoint
    meg.set_meg_connection(meg_data_connection)
    print(f"DEBUG: EnhancedMEGConnection instance set for meg router: {meg_data_connection}")

    # Initialize N1Commander
    n1_commander_instance = N1Commander()
    print(f"DEBUG: N1Commander instance created: {n1_commander_instance}")
    system_routes.set_n1_commander(n1_commander_instance)
    print(f"DEBUG: N1Commander instance set for system router: {n1_commander_instance}")

    # Set logging level for meg_connection module explicitly
    logging.getLogger('MEG_BCI.meg_connection').setLevel(logging.WARNING) # Set to WARNING as requested by user

    yield
    # Shutdown
    print("Shutting down MEG ChatGPT BCI Backend...")
    if sensor_status_connection:
        sensor_status_connection.disconnect()
    if meg_data_connection:
        meg_data_connection.disconnect()
    if n1_commander_instance:
        n1_commander_instance.disconnect()


app = FastAPI(
    title="MEG ChatGPT BCI API",
    description="FastAPI backend for MEG-based Brain-Computer Interface with ChatGPT integration",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(meg.router, tags=["MEG"])
app.include_router(training_routes.router, prefix="/api/training", tags=["Training"])
app.include_router(inference_routes.router, prefix="/api/inference", tags=["Inference"])
app.include_router(system_routes.router, prefix="/api/system", tags=["System"])
app.include_router(analysis_routes.router, prefix="/api/analysis", tags=["Analysis"])


@app.get("/")
async def root():
    """Root endpoint for health check."""
    return {"message": "MEG ChatGPT BCI Backend is running"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "meg-chatgpt-bci-backend"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
