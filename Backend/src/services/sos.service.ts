import { dbInstances as prisma, SOSStatus, SOSType } from "@repo/db-customer";
import { Client } from "@googlemaps/google-maps-services-js";
import axios from "axios";

import { getSMSService } from "./sms.service";

const googleMapsClient = new Client({});
const smsService = getSMSService();

// OpenRouter AI-based Geocoding & Mapping
const openRouterMapping = {
  async fetchAIResponse(prompt: string): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return "API key missing";
    try {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://gupio.com",
            "X-Title": "GUPIO Customer App",
          },
        },
      );
      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error("OpenRouter Error:", error.message);
      return "{}";
    }
  },

  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const prompt = `Return ONLY a JSON object with a single key "address" containing a human-readable street address for coordinates ${lat}, ${lng}. Be precise.`;
    const res = await this.fetchAIResponse(prompt);
    try {
      return JSON.parse(res).address;
    } catch {
      return null;
    }
  },

  async getNearbyHelp(lat: number, lng: number, type: string): Promise<any[]> {
    const prompt = `Return ONLY a JSON object with a key "results" containing an array of 5 real ${type} facilities near coordinates ${lat}, ${lng}. 
    Each object must have: "name", "vicinity" (address), "geometry" (latitude/longitude object), "place_id" (unique string), and "rating" (number). 
    Use your knowledge base for real-world locations.`;
    const res = await this.fetchAIResponse(prompt);
    try {
      const data = JSON.parse(res);
      return (data.results || []).map((place: any) => ({
        name: place.name,
        address: place.vicinity,
        location: place.geometry?.location || { lat: lat + 0.001, lng: lng + 0.001 },
        rating: place.rating || 4.0,
        placeId: place.place_id || `ai_${Math.random()}`,
        types: [type.toLowerCase()],
      }));
    } catch {
      return [];
    }
  },
};

const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === "your-google-maps-key-here") return null;

  try {
    const response = await googleMapsClient.reverseGeocode({
      params: {
        latlng: { lat, lng },
        key: apiKey,
      },
    });
    return response.data.results[0]?.formatted_address || null;
  } catch (error) {
    console.error("Reverse Geocoding Error:", error);
    return null;
  }
};

export const sosService = {
  createSOS: async (
    customerId: string,
    latitude: number,
    longitude: number,
    type: SOSType,
    address?: string,
    metadata?: any,
  ) => {
    // 1. Try to get real address if not provided
    let finalAddress = address;
    if (!finalAddress) {
      // Use OpenRouter if API Key is present, else fallback
      if (process.env.OPENROUTER_API_KEY) {
        finalAddress = (await openRouterMapping.reverseGeocode(latitude, longitude)) || undefined;
      }
      
      if (!finalAddress && process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY !== "your-google-maps-key-here") {
        finalAddress = (await reverseGeocode(latitude, longitude)) || undefined;
      }
    }

    // 2. Create SOS record
    const sos = await prisma.sOSRequest.create({
      data: {
        customerId,
        latitude,
        longitude,
        type,
        address: finalAddress,
        metadata: metadata || {},
        status: SOSStatus.ACTIVE,
      },
    });

    // 3. Notify Emergency Contacts (and fetch customer name)
    const [contacts, customer] = await Promise.all([
      prisma.emergencyContact.findMany({
        where: { customerId },
        select: { id: true, name: true, phoneNumber: true, email: true, relation: true, priority: true },
        orderBy: { priority: "asc" },
      }),
      prisma.customer.findUnique({
        where: { id: customerId },
        select: { fullName: true, email: true },
      }),
    ]);

    const senderName = customer?.fullName || "A user";
    console.log(`\n🔔 ALERTED CONTACTS FOR SOS (${type}) from ${senderName}:`, contacts.map(c => `${c.name} (Phone: ${c.phoneNumber}, Email: ${c.email || 'None'})`).join(" | ") || "No contacts found");

    const mapUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
    const locationInfo = finalAddress ? `${finalAddress} (${mapUrl})` : mapUrl;
    
    // 4. Construct Alert Message
    const userMessage = metadata?.message ? `\n\nMessage: "${metadata.message}"` : '';
    const alertMessage = `🚨 SOS ALERT from ${senderName}! They have reported a ${type} emergency at ${locationInfo}.${userMessage}\n\nPlease help immediately!`;

    // Import the dedicated sendEmail helper if not already available in this scope, but we use sms.service.ts exports
    const { sendEmail } = require("./sms.service");

    for (const contact of contacts) {
      // 1. Send SMS via configured SMS Service (Flash49, Twilio, Mock, etc.)
      const isSmtpService = process.env.SMS_SERVICE === 'SMTP' || process.env.SMS_SERVICE === 'GMAIL';
      
      if (!isSmtpService) {
        // Only try to send an SMS to a phone number if the service is an actual SMS provider, to prevent Nodemailer from throwing "No recipients defined"
        try {
          await smsService.sendSMS(contact.phoneNumber, alertMessage);
        } catch (e) {
          console.error(`Failed to send SMS to ${contact.phoneNumber}:`, e);
        }
      }
      
      // 2. Send dedicated Email via Nodemailer explicitly
      if (contact.email) {
        try {
          await sendEmail({
            to: contact.email,
            subject: `URGENT: SOS EMERGENCY ALERT - ${type}`,
            text: alertMessage,
          });
          console.log(`📧 Successfully sent SOS email to emergency contact: ${contact.email}`);
        } catch (e) {
          console.error(`Failed to send SOS Email to ${contact.email}:`, e);
        }
      }

      if (smsService.sendVoice) {
        await smsService.sendVoice(
          contact.phoneNumber,
          `This is an emergency alert. Your contact has reported a ${type} emergency. Please check your messages for location.`
        );
      }
    }

    // Always send a backup email to the sender's own email if available
    if (customer?.email) {
        console.log(`📧 Sending backup SOS email to user: ${customer.email}`);
        try {
           await sendEmail({
             to: customer.email,
             subject: `CONFIRMATION: Your SOS ALERT was triggered`,
             text: `SOS ALERT CONFIRMATION:\n\n${alertMessage}`
           });
        } catch (e) {
             console.error(`Failed to send backup SOS Email to ${customer.email}:`, e);
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
    // 1. Try OpenRouter if configured
    if (process.env.OPENROUTER_API_KEY) {
      console.log(`🤖 Using OpenRouter AI to find nearby ${type}...`);
      return await openRouterMapping.getNearbyHelp(latitude, longitude, type);
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    // Fallback Mock Data for testing if API Key is missing or user prefers mock
    const getMockHelp = (lat: number, lng: number, keyword: string) => [
      {
        name: `Local ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} A`,
        address: "123 Emergency St, Nearby City",
        location: { lat: lat + 0.005, lng: lng + 0.005 },
        rating: 4.5,
        placeId: "mock_1",
        types: [keyword, "health"],
      },
      {
        name: `City ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} B`,
        address: "456 Safety Rd, Downtown",
        location: { lat: lat - 0.008, lng: lng + 0.002 },
        rating: 4.2,
        placeId: "mock_2",
        types: [keyword, "establishment"],
      },
    ];

    try {
      let keyword = "hospital";
      if (type === SOSType.POLICE) keyword = "police station";
      if (type === SOSType.MECHANICAL || type === SOSType.ACCIDENT)
        keyword = "car repair";

      if (!apiKey || apiKey === "your-google-maps-key") {
        console.warn("Google Maps API Key is missing. Returning mock data.");
        return getMockHelp(latitude, longitude, keyword);
      }

      const response = await googleMapsClient.placesNearby({
        params: {
          location: { lat: latitude, lng: longitude },
          radius: 5000, // 5km
          keyword,
          key: apiKey,
        },
      });

      if (!response.data.results || response.data.results.length === 0) {
        return getMockHelp(latitude, longitude, keyword);
      }

      return response.data.results.map((place) => ({
        name: place.name,
        address: place.vicinity,
        location: place.geometry?.location,
        rating: place.rating,
        placeId: place.place_id,
        types: place.types,
      }));
    } catch (error) {
      console.error("Google Maps API Error, falling back to mock:", error);
      let keyword = "hospital";
      if (type === SOSType.POLICE) keyword = "police station";
      if (type === SOSType.MECHANICAL || type === SOSType.ACCIDENT)
        keyword = "car repair";
      return getMockHelp(latitude, longitude, keyword);
    }
  },

  addContact: async (
    customerId: string,
    data: {
      name: string;
      phoneNumber: string;
      email?: string;
      relation?: string;
      priority?: number;
    },
  ) => {
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
      where: { id: contactId, customerId: customerId },
    });
  },

  getActiveSOS: async (customerId: string) => {
    return await prisma.sOSRequest.findFirst({
      where: {
        customerId,
        status: SOSStatus.ACTIVE,
      },
      orderBy: { createdAt: "desc" },
    });
  },
};
