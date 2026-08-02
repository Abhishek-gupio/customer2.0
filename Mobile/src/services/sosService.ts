import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getAccessToken } from './storage';

const API_URL = `${API_BASE_URL}/api/v1/sos`;

function authHeaders(): Record<string, string> {
    const token = getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export type SOSType = 'MEDICAL' | 'FIRE' | 'POLICE' | 'OTHER' | 'MECHANICAL' | 'ACCIDENT';

export interface EmergencyContact {
    id: string;
    name: string;
    phoneNumber: string;
    email?: string;
    relation?: string;
    priority?: number;
}

export interface NearbyHelpItem {
    placeId?: string;
    name?: string;
    address?: string;
    type?: string;
    phoneNumber?: string;
    location?: { lat: number; lng: number };
}

class SOSService {
    async getNearbyHelp(lat: number, lon: number, type: SOSType): Promise<NearbyHelpItem[]> {
        const response = await axios.get(`${API_URL}/nearby-help`, {
            params: { latitude: lat, longitude: lon, type },
            headers: authHeaders(),
        });
        return response.data;
    }

    async getContacts(): Promise<EmergencyContact[]> {
        const response = await axios.get(`${API_URL}/contacts`, {
            headers: authHeaders(),
        });
        return response.data;
    }

    async addContact(contact: Omit<EmergencyContact, 'id'>): Promise<EmergencyContact> {
        const response = await axios.post(`${API_URL}/contacts`, contact, {
            headers: authHeaders(),
        });
        return response.data;
    }

    async deleteContact(id: string): Promise<void> {
        await axios.delete(`${API_URL}/contacts/${id}`, {
            headers: authHeaders(),
        });
    }

    async triggerSOS(data: { location: { latitude: number; longitude: number; accuracy?: number }; message?: string; type: SOSType; metadata?: any }): Promise<{ success: boolean; sosAlertId: string }> {
        const payload = {
            latitude: data.location.latitude,
            longitude: data.location.longitude,
            type: data.type,
            // `accuracy` is forwarded in metadata rather than dropped: responders need to know
            // whether these coordinates are a precise GPS fix or a fallback that could be
            // kilometres out. Callers compute it deliberately (see deviceLocation.ts).
            metadata: { message: data.message, accuracy: data.location.accuracy, ...data.metadata }
        };
        try {
            const response = await axios.post(`${API_URL}`, payload, {
                headers: authHeaders(),
            });
            return { success: true, sosAlertId: response.data.id };
        } catch (error: any) {
             throw new Error(error.response?.data?.message || 'Failed to trigger SOS');
        }
    }

    async getActiveSOS(): Promise<any> {
        const response = await axios.get(`${API_URL}/active`, {
            headers: authHeaders(),
        });
        return response.data;
    }

    async resolveSOS(id: string): Promise<void> {
        await axios.post(`${API_URL}/${id}/resolve`, {}, {
            headers: authHeaders(),
        });
    }
}

export const sosService = new SOSService();
