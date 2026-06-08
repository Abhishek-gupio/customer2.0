"""Places router — /api/v1/places/*"""
from fastapi import APIRouter, Depends

from app.core.config import settings
from app.dependencies.auth import get_current_customer
from app.models.customer import Customer
from app.schemas.common import success

router = APIRouter()


@router.get("/search")
async def search_places(
    query: str = "",
    lat: float | None = None,
    lng: float | None = None,
    customer: Customer = Depends(get_current_customer),
):
    if not settings.GOOGLE_MAPS_API_KEY:
        return success({"places": []})
    try:
        import googlemaps
        gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
        result = gmaps.places_autocomplete(query, location=(lat, lng) if lat and lng else None)
        places = [{"placeId": p["place_id"], "description": p["description"]} for p in result]
        return success({"places": places})
    except Exception:
        return success({"places": []})


@router.get("/details")
async def get_place_details(
    place_id: str,
    customer: Customer = Depends(get_current_customer),
):
    if not settings.GOOGLE_MAPS_API_KEY:
        return success({"place": None})
    try:
        import googlemaps
        gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
        result = gmaps.place(place_id=place_id, fields=["name", "geometry", "formatted_address"])
        r = result.get("result", {})
        return success({
            "place": {
                "name": r.get("name"),
                "address": r.get("formatted_address"),
                "lat": r.get("geometry", {}).get("location", {}).get("lat"),
                "lng": r.get("geometry", {}).get("location", {}).get("lng"),
            }
        })
    except Exception:
        return success({"place": None})


@router.get("/reverse-geocode")
async def reverse_geocode(
    lat: float,
    lng: float,
    customer: Customer = Depends(get_current_customer),
):
    if not settings.GOOGLE_MAPS_API_KEY:
        return success({"address": None})
    try:
        import googlemaps
        gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
        result = gmaps.reverse_geocode((lat, lng))
        address = result[0]["formatted_address"] if result else None
        return success({"address": address, "lat": lat, "lng": lng})
    except Exception:
        return success({"address": None})


@router.get("/nearby")
async def nearby_services(
    lat: float,
    lng: float,
    type: str = "car_repair",
    customer: Customer = Depends(get_current_customer),
):
    if not settings.GOOGLE_MAPS_API_KEY:
        return success({"places": []})
    try:
        import googlemaps
        gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
        result = gmaps.places_nearby(location=(lat, lng), radius=5000, type=type)
        places = [
            {
                "name": p.get("name"),
                "rating": p.get("rating"),
                "vicinity": p.get("vicinity"),
                "lat": p.get("geometry", {}).get("location", {}).get("lat"),
                "lng": p.get("geometry", {}).get("location", {}).get("lng"),
            }
            for p in result.get("results", [])[:10]
        ]
        return success({"places": places})
    except Exception:
        return success({"places": []})
