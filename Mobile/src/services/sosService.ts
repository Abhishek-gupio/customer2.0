export type SOSType = 'MEDICAL' | 'FIRE' | 'POLICE' | 'OTHER';

export interface EmergencyContact {
    id: string;
    name: string;
    phoneNumber: string;
    relation?: string;
}

export interface NearbyHelpItem {
    placeId?: string;
    name?: string;
    address?: string;
    location?: { lat: number; lng: number };
}

class SOSService {
    async getNearbyHelp(lat: number, lon: number, type: SOSType): Promise<NearbyHelpItem[]> {
        return [
            {
                placeId: '1',
                name: 'City Hospital',
                address: '123 Main St',
                location: { lat: lat + 0.01, lng: lon + 0.01 },
            },
        ];
    }

    async getContacts(): Promise<EmergencyContact[]> {
        return [];
    }

    async addContact(contact: Omit<EmergencyContact, 'id'>): Promise<EmergencyContact> {
        return { ...contact, id: Math.random().toString() };
    }

    async deleteContact(id: string): Promise<void> { }

    async createSOS(data: { latitude: number; longitude: number; type: SOSType; metadata: any }): Promise<void> { }
}

export const sosService = new SOSService();
