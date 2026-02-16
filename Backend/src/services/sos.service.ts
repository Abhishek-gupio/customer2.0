
import { dbInstances as prisma, SOSStatus, SOSType } from "@repo/db-customer";
import { Client } from "@googlemaps/google-maps-services-js";

import { getSMSService } from "./sms.service";

const googleMapsClient = new Client({});
const smsService = getSMSService();

export const sosService = {
    createSOS: async (customerId: string, latitude: number, longitude: number, type: SOSType, address?: string, metadata?: any) => {
        // 1. Create SOS record
        const sos = await prisma.sOSRequest.create({
            data: {
                customerId,
                latitude,
                longitude,
                type,
                address,
                metadata: metadata || {},
                status: SOSStatus.ACTIVE,
            },
        });

        // 2. Notify Emergency Contacts
        const contacts = await prisma.emergencyContact.findMany({
            where: { customerId },
            orderBy: { priority: "asc" },
        });

        const message = `SOS ALERT! User has reported a ${type} emergency at https://maps.google.com/?q=${latitude},${longitude}. Please help immediately!`;

        for (const contact of contacts) {
            await smsService.sendSMS(contact.phoneNumber, message);
            if (smsService.sendVoice) {
                await smsService.sendVoice(contact.phoneNumber, `This is an emergency alert. Your contact has reported a ${type} emergency. Please check your SMS for location.`);
            }
        }

        return sos;
    },

    resolveSOS: async (sosId: string) => {
        return await prisma.sOSRequest.update({
            where: { id: sosId },
            data: {
                status: SOSStatus.RESOLVED,
                resolvedAt: new Date(),
            },
        });
    },

    getNearbyHelp: async (latitude: number, longitude: number, type: SOSType) => {
        try {
            let keyword = "hospital";
            if (type === SOSType.POLICE) keyword = "police station";
            if (type === SOSType.MECHANICAL || type === SOSType.ACCIDENT) keyword = "car repair";

            const response = await googleMapsClient.placesNearby({
                params: {
                    location: { lat: latitude, lng: longitude },
                    radius: 5000, // 5km
                    keyword,
                    key: process.env.GOOGLE_MAPS_API_KEY || "",
                },
            });

            return response.data.results.map((place) => ({
                name: place.name,
                address: place.vicinity,
                location: place.geometry?.location,
                rating: place.rating,
                placeId: place.place_id,
                types: place.types,
            }));
        } catch (error) {
            console.error("Google Maps API Error:", error);
            return [];
        }
    },

    addContact: async (customerId: string, data: { name: string; phoneNumber: string; relation?: string; priority?: number }) => {
        return await prisma.emergencyContact.create({
            data: {
                customerId,
                ...data,
            },
        });
    },

    getContacts: async (customerId: string) => {
        return await prisma.emergencyContact.findMany({
            where: { customerId },
            orderBy: { priority: "asc" },
        });
    },

    deleteContact: async (customerId: string, contactId: string) => {
        return await prisma.emergencyContact.delete({
            where: { id: contactId, customerId: customerId }
        })
    }
};
