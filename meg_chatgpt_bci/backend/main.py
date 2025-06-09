"""
FastAPI main application entry point for MEG ChatGPT BCI system.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from api import meg, training_routes, inference_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown tasks."""
    # Startup
    print("Starting MEG ChatGPT BCI Backend...")
    yield
    # Shutdown
    print("Shutting down MEG ChatGPT BCI Backend...")


app = FastAPI(
    title="MEG ChatGPT BCI API",
    description="FastAPI backend for MEG-based Brain-Computer Interface with ChatGPT integration",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(meg.router, tags=["MEG"])
app.include_router(training_routes.router, prefix="/api/training", tags=["Training"])
app.include_router(inference_routes.router, prefix="/api/inference", tags=["Inference"])


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
