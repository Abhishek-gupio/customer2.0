export type SupportedIntent =
  | "open_screen"
  | "add_expense"
  | "get_challans"
  | "get_expenses_summary"
  | "get_vehicle_status"
  | "get_driving_trips_summary"
  | "trigger_sos"
  | "unsupported";

export interface BaseIntent {
  intent: SupportedIntent;
}

export interface OpenScreenIntent extends BaseIntent {
  intent: "open_screen";
  screenName: string; // e.g. "VehicleList", "Challans", "DrivingSummary", "TripExpense", "ServiceHistory", "WarrantyStatus", "Expenses", "SOS", "DocumentList", "Valet", "AddVehicle", "MyProfile", "HelpSupport", "Settings", "BudgetSettings", "DLVerification", "Fastag", "DIYGuides", "Odometer", "Home", "Services"
}

export interface AddExpenseIntent extends BaseIntent {
  intent: "add_expense";
  amount: number;
  category: string; // e.g. "FUEL", "TOLL", "SERVICE", "PARKING", "INSURANCE", "CHALLAN", "OTHER"
  merchantName?: string;
  notes?: string;
}

export interface GetChallansIntent extends BaseIntent {
  intent: "get_challans";
  registrationNumber?: string;
}

export interface SimpleIntent extends BaseIntent {
  intent: "get_expenses_summary" | "get_vehicle_status" | "get_driving_trips_summary" | "trigger_sos";
}

export interface UnsupportedIntent extends BaseIntent {
  intent: "unsupported";
  message: string;
}

export type Intent =
  | OpenScreenIntent
  | AddExpenseIntent
  | GetChallansIntent
  | SimpleIntent
  | UnsupportedIntent;
