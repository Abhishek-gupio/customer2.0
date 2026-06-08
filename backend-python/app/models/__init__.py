"""
Import all models here so Alembic can discover them via metadata
and SQLAlchemy relationship resolution works across modules.
"""
from app.models.admin import AdminRole, AdminUser
from app.models.chat import ChatAnalytics, ChatMessage, ChatSession
from app.models.customer import Customer, CustomerDevice
from app.models.document import (
    DigiLockerConnection,
    DrivingLicense,
    FastagDocument,
    VehicleDocument,
)
from app.models.expense import Expense, ExpenseBudget, FuelPriceCache
from app.models.notification import InAppNotification
from app.models.service import PartReplacementInterval, ServicePart, ServiceRecord
from app.models.sharing import DiscoveryContent, PlannedTrip
from app.models.sos import EmergencyContact, SOSRequest
from app.models.support import FAQ, SupportTicket, TicketMessage
from app.models.telematics import DrivingEvent, DrivingTrip, TelematicsDevice
from app.models.vehicle import (
    AccessRole,
    Challan,
    CustomerVehicle,
    OdometerLog,
    VehicleAccess,
    VehicleAsset,
    VehicleAssetType,
    VehicleCatalog,
    VehicleHealthScore,
)

__all__ = [
    "AdminRole", "AdminUser",
    "Customer", "CustomerDevice",
    "CustomerVehicle", "VehicleCatalog", "VehicleAsset", "VehicleAssetType",
    "OdometerLog", "Challan", "VehicleHealthScore", "VehicleAccess", "AccessRole",
    "VehicleDocument", "DrivingLicense", "FastagDocument", "DigiLockerConnection",
    "Expense", "ExpenseBudget", "FuelPriceCache",
    "ServiceRecord", "ServicePart", "PartReplacementInterval",
    "TelematicsDevice", "DrivingTrip", "DrivingEvent",
    "ChatSession", "ChatMessage", "ChatAnalytics",
    "InAppNotification",
    "SupportTicket", "TicketMessage", "FAQ",
    "SOSRequest", "EmergencyContact",
    "PlannedTrip", "DiscoveryContent",
]
