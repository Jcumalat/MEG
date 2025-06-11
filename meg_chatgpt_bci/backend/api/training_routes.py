# Placeholder for training routes
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_training_data():
    return {"message": "Training data endpoint"}
