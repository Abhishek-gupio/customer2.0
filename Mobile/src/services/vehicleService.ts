import { api } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Vehicle {
    id: string;
    customerId: string;
    registrationNumber: string;
    make?: string;
    model?: string;
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
    color?: string;
    unloadedWeight?: string;
    manufacturingMonthYear?: string;
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
    make?: string;
    model?: string;
    vehicleClass?: string;
    engineNo?: string;
    chassisNo?: string;
    fuelType?: string;
    fuelNorms?: string;
    transmission?: string;
    priceRange?: string;
    rating?: string;
    rcStatus?: string;
    unloadedWeight?: string;
    vehicleType?: string;
    regDate?: string;
    fitnessUpto?: string;
    insuranceUpto?: string;
    pollutionUpto?: string;
    mileage?: string;
    brand?: string;
    imageUrl?: string;
    engineNumber?: string;
    chassisNumber?: string;
    registrationDate?: string;
    color?: string;
    registrationNumber?: string;
    manufacturingMonthYear?: string;
    present_address?: string;
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

export interface VehicleAssets {
    heroUrl: string | null;
    angles: string[]; // expected order: assetIndex 0..11
}

export interface AddVehicleInput {
    registrationNumber: string;
    make?: string;
    model?: string;
    fuelType?: 'PETROL' | 'DIESEL' | 'CNG' | 'EV' | 'HYBRID' | 'OTHER';
    vehicleType?: 'LUV' | 'SUV' | 'SEDAN' | 'BIKE' | 'HATCHBACK' | 'TRUCK';
    engineNumber?: string;
    chassisNumber?: string;
    registrationDate?: string | Date;
    currentOdometer?: number;
    ownerName?: string;
    rto?: string;
    vehicleClass?: string;
    fuelNorms?: string;
    rcStatus?: string;
    unloadedWeight?: string;
    fitnessUpto?: string;
    insuranceUpto?: string;
    pollutionUpto?: string;
    mileage?: string;
    brand?: string;
    color?: string;
    manufacturingMonthYear?: string;
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

export interface OdometerExtraction {
    reading: number;
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
        const raw = response as unknown as { data?: Vehicle; success?: boolean };
        return raw?.data ?? (response as unknown as Vehicle);
    },

    getVehicleAssets: async (vehicleId: string): Promise<VehicleAssets> => {
        const response = await api.get<{ success: boolean; data: VehicleAssets }>(
            `/v1/vehicles/${vehicleId}/assets`,
        );
        const raw = response as unknown as { data?: VehicleAssets; success?: boolean };
        return raw?.data ?? (response as unknown as VehicleAssets);
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

    extractOdometerViaAI: async (id: string, photo: FormData): Promise<OdometerExtraction> => {
        const response = await api.upload<{ success: boolean; data: OdometerExtraction }>(
            `/v1/vehicles/${id}/odometer-ai/extract`,
            photo,
        );
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

    verifyVehicle: async (regNo: string): Promise<RTODetails> => {
        const response = await api.post<{ success: boolean; data: any }>('/v1/vehicles/verify', { reg_no: regNo });
        // Map backend fields (VerifiedVehicle) to RTODetails
        const raw = response.data;
        return {
            ownerName: raw.ownerName,
            rto: raw.rto,
            make: raw.make,
            model: raw.model,
            vehicleClass: raw.vehicleClass,
            engineNo: raw.engineNumber || raw.engineNo,
            chassisNo: raw.chassisNumber || raw.chassisNo,
            fuelType: raw.fuelType,
            fuelNorms: raw.fuelNorms,
            transmission: raw.transmission,
            priceRange: raw.priceRange,
            rating: raw.rating,
            rcStatus: raw.rcStatus,
            unloadedWeight: raw.unloadedWeight,
            vehicleType: raw.vehicleType,
            regDate: raw.registrationDate || raw.regDate,
            fitnessUpto: raw.fitnessUpto,
            insuranceUpto: raw.insuranceUpto,
            pollutionUpto: raw.pollutionUpto,
            mileage: raw.mileage,
            brand: raw.make,
            color: raw.color,
            manufacturingMonthYear: raw.manufacturingMonthYear,
        };
    },
};

export const FALLBACK_CAR_IMAGE =
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800';
