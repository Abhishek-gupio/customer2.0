"""AI coaching / insights router — /api/v1/ai/*"""
from fastapi import APIRouter, Depends

from app.core.config import settings
from app.dependencies.auth import get_current_customer
from app.dependencies.database import get_db
from app.models.customer import Customer
from app.schemas.common import success

router = APIRouter()


@router.post("/coach")
async def ai_coach(
    body: dict,
    customer: Customer = Depends(get_current_customer),
):
    question = body.get("question", "")
    context = body.get("context", {})
    if not settings.GEMINI_API_KEY:
        return success({"answer": "AI coaching is not configured.", "suggestions": []})
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-pro")
        system_ctx = "You are a helpful vehicle maintenance assistant for GuPio app."
        response = model.generate_content(f"{system_ctx}\n\nUser question: {question}")
        return success({"answer": response.text, "suggestions": []})
    except Exception:
        return success({"answer": "AI service temporarily unavailable.", "suggestions": []})


@router.post("/insights")
async def get_insights(
    body: dict,
    customer: Customer = Depends(get_current_customer),
):
    return success({"insights": [], "recommendations": []})


@router.post("/predict/maintenance")
async def predict_maintenance(
    body: dict,
    customer: Customer = Depends(get_current_customer),
):
    vehicle_id = body.get("vehicleId")
    return success({
        "vehicleId": vehicle_id,
        "predictions": [],
        "nextServiceDue": None,
    })


@router.post("/analyze/trip")
async def analyze_trip(
    body: dict,
    customer: Customer = Depends(get_current_customer),
):
    return success({"score": None, "feedback": [], "tips": []})


@router.get("/recommendations/{vehicle_id}")
async def get_recommendations(
    vehicle_id: str,
    customer: Customer = Depends(get_current_customer),
):
    return success({"vehicleId": vehicle_id, "recommendations": []})
