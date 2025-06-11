from fastapi import APIRouter
from typing import List, Union # Import Union
from pydantic import BaseModel

router = APIRouter(prefix="/api/analysis", tags=["Analysis"])

class ChannelAnalysis(BaseModel):
    channelId: int
    name: str
    isActive: bool
    signalQuality: Union['excellent', 'good', 'fair', 'poor'] # Use Union for compatibility
    snr: float
    variance: float
    artifacts: List[str]
    lastUpdate: str

@router.get("/channels", response_model=List[ChannelAnalysis])
async def get_channels():
    """
    Returns mock channel analysis data.
    """
    mock_channels: List[ChannelAnalysis] = []
    for i in range(1, 193): # 192 channels
        mock_channels.append({
            "channelId": i,
            "name": f"Channel {i}",
            "isActive": True,
            "signalQuality": "good",
            "snr": 20.0 + (i % 10) * 0.5,
            "variance": 0.001 + (i % 5) * 0.0001,
            "artifacts": [],
            "lastUpdate": "2025-06-10T12:00:00Z"
        })
    return mock_channels
