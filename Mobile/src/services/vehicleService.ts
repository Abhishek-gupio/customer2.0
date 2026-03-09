import { api } from './api';

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
    [key: string]: any;
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

export const vehicleService = {
    // ---- Vehicle Core APIs ----

    addVehicle: async (data: AddVehicleInput) => {
        const response = await api.post<{ success: boolean; data: Vehicle }>('/v1/vehicles', data);
        return response.data;
    },

    getVehicles: async () => {
        const response = await api.get<{ success: boolean; data: Vehicle[] }>('/v1/vehicles');
        return response.data || [];
    },

    getVehicleById: async (id: string) => {
        const response = await api.get<{ success: boolean; data: Vehicle }>(`/v1/vehicles/${id}`);
        return response.data;
    },

    updateVehicle: async (id: string, data: UpdateVehicleInput) => {
        const response = await api.put<{ success: boolean; data: Vehicle }>(`/v1/vehicles/${id}`, data);
        return response.data;
    },

    deleteVehicle: async (id: string) => {
        const response = await api.delete<{ success: boolean; data: any }>(`/v1/vehicles/${id}`);
        return response.data;
    },

    setPrimaryVehicle: async (id: string) => {
        const response = await api.put<{ success: boolean; data: Vehicle }>(`/v1/vehicles/${id}/primary`);
        return response.data;
    },

    // ---- Vehicle Health APIs ----
    recalculateHealth: async (id: string) => {
        const response = await api.post<{ success: boolean; data: any }>(`/v1/vehicles/${id}/health/recalculate`);
        return response.data;
    },

    // ---- Odometer APIs ----
    addOdometer: async (id: string, data: AddOdometerInput) => {
        const response = await api.post<{ success: boolean; data: OdometerLog }>(`/v1/vehicles/${id}/odometer`, data);
        return response.data;
    },

    addOdometerViaAI: async (id: string, photo: FormData) => {
        const response = await api.upload<{ success: boolean; data: OdometerLog }>(`/v1/vehicles/${id}/odometer-ai`, photo);
        return response.data;
    },

    // ---- Challan APIs ----
    getChallans: async (vehicleId: string) => {
        const response = await api.get<{ success: boolean; data: Challan[] }>(`/v1/vehicles/${vehicleId}/challans`);
        return response.data || [];
    },

    syncChallans: async (vehicleId: string) => {
        const response = await api.post<{ success: boolean; data: Challan[] }>(`/v1/vehicles/${vehicleId}/challans/sync`);
        return response.data || [];
    },

    markChallanAsPaid: async (challanId: string) => {
        const response = await api.patch<{ success: boolean; data: Challan }>(`/v1/vehicles/challans/${challanId}/pay`);
        return response.data;
    }
};
