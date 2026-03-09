import { api } from './api';

export interface Vehicle {
    id: string;
    registrationNumber: string;
    isPrimary: boolean;
    [key: string]: any;
}

export const vehicleService = {
    getVehicles: async () => {
        const response = await api.get<{ success: boolean; data: Vehicle[] }>('/v1/vehicles');
        return response.data || [];
    }
};
