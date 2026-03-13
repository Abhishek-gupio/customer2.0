import { api } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Vehicle {
    id: string;
    customerId: string;
    registrationNumber: string;
    make?: string;
    model?: string;
    variant?: string;
    year?: number;
    fuelType?: string;
    vehicleType?: string;
    engineNumber?: string;
    chassisNumber?: string;
    registrationDate?: string;
    currentOdometer?: number;
    isPrimary: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    healthScore?: VehicleHealthScore;
    // AI-enriched data from Gemini RTO lookup (stored client-side, not in DB)
    rtoDetails?: RTODetails;
    // Optimistic UI flag — never sent to backend
    __optimistic?: boolean;
    [key: string]: any;
}

export interface RTODetails {
    ownerName?: string;
    rto?: string;
    chassisNo?: string;
    engineNo?: string;
    fuelType?: string;
    fuelNorms?: string;
    priceRange?: string;
    rating?: number;
    transmission?: string;
    mileage?: string;
    regDate?: string;
    fitnessUpto?: string;
    insuranceUpto?: string;
    pollutionUpto?: string;
    unloadedWeight?: string;
    rcStatus?: string;
    brand?: string;
    // AI-generated image URL — client-side only, not saved to DB
    imageUrl?: string;
}

export interface VehicleHealthScore {
    id: string;
    vehicleId: string;
    overallScore: number;
    explanations: string[];
    createdAt: string;
    updatedAt: string;
    [key: string]: any;
}

export interface AddVehicleInput {
    registrationNumber: string;
    make?: string;
    model?: string;
    variant?: string;
    year?: number;
    fuelType?: 'PETROL' | 'DIESEL' | 'CNG' | 'EV' | 'HYBRID' | 'OTHER';
    vehicleType?: 'LUV' | 'SUV' | 'SEDAN' | 'BIKE' | 'HATCHBACK' | 'TRUCK';
    engineNumber?: string;
    chassisNumber?: string;
    registrationDate?: string | Date;
    currentOdometer?: number;
}

export type UpdateVehicleInput = Partial<AddVehicleInput>;

export interface AddOdometerInput {
    reading: number;
    date?: string | Date;
}

export interface OdometerLog {
    id: string;
    vehicleId: string;
    reading: number;
    date: string;
    createdAt: string;
    updatedAt: string;
}

export interface Challan {
    id: string;
    vehicleId: string;
    violationNumber: string;
    amount: number;
    status: string;
    violationDate: string;
    location?: string;
    createdAt: string;
    updatedAt: string;
    [key: string]: any;
}

// ─── Indian RTO Plate Validation ─────────────────────────────────────────────

// Format: XX00XX0000 — 2 letters, 2 digits, 1-3 letters, 4 digits (e.g. MH04AB1234)
const RTO_PLATE_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;

export const isValidIndianPlate = (plate: string): boolean =>
    RTO_PLATE_REGEX.test(plate.toUpperCase().replace(/\s/g, ''));

// ─── Gemini Config ────────────────────────────────────────────────────────────

// ─── Vehicle Service ──────────────────────────────────────────────────────────

export const vehicleService = {

    // ── Core Vehicle APIs ────────────────────────────────────────────────────

    addVehicle: async (data: AddVehicleInput): Promise<Vehicle> => {
        // Backend now generates + saves imageUrl automatically via Gemini
        const response = await api.post<{ success: boolean; data: Vehicle }>('/v1/vehicles', data);
        return response.data;
    },

    getVehicles: async (): Promise<Vehicle[]> => {
        const response = await api.get<{ success: boolean; data: Vehicle[] }>('/v1/vehicles');
        return response.data || [];
    },

    getVehicleById: async (id: string): Promise<Vehicle> => {
        const response = await api.get<{ success: boolean; data: Vehicle }>(`/v1/vehicles/${id}`);
        return response.data;
    },

    updateVehicle: async (id: string, data: UpdateVehicleInput): Promise<Vehicle> => {
        const response = await api.put<{ success: boolean; data: Vehicle }>(`/v1/vehicles/${id}`, data);
        return response.data;
    },

    deleteVehicle: async (id: string): Promise<any> => {
        const response = await api.delete<{ success: boolean; data: any }>(`/v1/vehicles/${id}`);
        return response.data;
    },

    setPrimaryVehicle: async (id: string): Promise<Vehicle> => {
        const response = await api.put<{ success: boolean; data: Vehicle }>(`/v1/vehicles/${id}/primary`);
        return response.data;
    },

    // ── Vehicle Health APIs ──────────────────────────────────────────────────

    recalculateHealth: async (id: string) => {
        const response = await api.post<{ success: boolean; data: any }>(`/v1/vehicles/${id}/health/recalculate`);
        return response.data;
    },

    // ── Odometer APIs ────────────────────────────────────────────────────────

    addOdometer: async (id: string, data: AddOdometerInput): Promise<OdometerLog> => {
        const response = await api.post<{ success: boolean; data: OdometerLog }>(`/v1/vehicles/${id}/odometer`, data);
        return response.data;
    },

    addOdometerViaAI: async (id: string, photo: FormData): Promise<OdometerLog> => {
        const response = await api.upload<{ success: boolean; data: OdometerLog }>(`/v1/vehicles/${id}/odometer-ai`, photo);
        return response.data;
    },

    // ── Challan APIs ─────────────────────────────────────────────────────────

    getChallans: async (vehicleId: string): Promise<Challan[]> => {
        const response = await api.get<{ success: boolean; data: Challan[] }>(`/v1/vehicles/${vehicleId}/challans`);
        return response.data || [];
    },

    syncChallans: async (vehicleId: string): Promise<Challan[]> => {
        const response = await api.post<{ success: boolean; data: Challan[] }>(`/v1/vehicles/${vehicleId}/challans/sync`);
        return response.data || [];
    },

    markChallanAsPaid: async (challanId: string): Promise<Challan> => {
        const response = await api.patch<{ success: boolean; data: Challan }>(`/v1/vehicles/challans/${challanId}/pay`);
        return response.data;
    },

    // ── AI: RTO Plate Lookup ─────────────────────────────────────────────────
    /**
     * Calls the BACKEND which in turn calls Gemini server-side.
     * The Gemini API key is NEVER in the mobile app.
     * Returns RTO details PLUS an AI-generated imageUrl (both from backend).
     */
    fetchVehicleData: async (vNo: string, model?: string): Promise<RTODetails | null> => {
        try {
            const params = model ? `?model=${encodeURIComponent(model)}` : '';
            const response = await api.get<{ success: boolean; data: RTODetails }>(
                `/v1/vehicles/lookup/${encodeURIComponent(vNo)}${params}`
            );
            // Backend already embedded imageUrl in the response
            return response.data;
        } catch (e) {
            console.error('[vehicleService] fetchVehicleData error:', e);
            return null;
        }
    },

    // ── AI: Vehicle Image (kept for compatibility, proxied via backend) ────────
    generateVehicleImage: async (_model: string): Promise<string> => {
        // Image generation now happens server-side in vehicle.service.ts.
        // This stub exists so AddVehicleScreen.tsx doesn't break during transition.
        return FALLBACK_CAR_IMAGE;
    },
};

export const FALLBACK_CAR_IMAGE =
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800';