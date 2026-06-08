"""Places / Google Maps schemas."""
from app.schemas.common import CamelModel


class NearbyPlacesResponse(CamelModel):
    places: list[dict]


class PlaceSearchResponse(CamelModel):
    places: list[dict]
