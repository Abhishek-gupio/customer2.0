import { dbInstances as prisma, SOSStatus, SOSType } from "@repo/db-customer";
import { Client } from "@googlemaps/google-maps-services-js";
import axios from "axios";

import { getSMSService, sendEmail } from "./sms.service";

const googleMapsClient = new Client({});
const smsService = getSMSService();


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
    if (!finalAddress && process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY !== "your-google-maps-key-here") {
      finalAddress = (await reverseGeocode(latitude, longitude)) || undefined;
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
    const timestamp = new Date().toLocaleString();
    const userMessage = metadata?.message ? `\n\nUser Message: "${metadata.message}"` : '';
    const alertMessage = `🚨 SOS EMERGENCY ALERT\n
    ${senderName} has triggered an SOS alert!
    
    Emergency Type: ${type}
    Time: ${timestamp}
    Location: ${finalAddress || 'Location provided below'}
    Coordinates: ${latitude}, ${longitude}
    
    Map Link: ${mapUrl}
    ${userMessage}
    
    Please take immediate action to assist them!`;

    // SMS and Email notifications
    for (const contact of contacts) {
      console.log(`[SOS Service] Processing notification for contact: ${contact.name} (${contact.phoneNumber})`);
      
      // 1. Send SMS via configured SMS Service
      const isSmtpService = process.env.SMS_SERVICE === 'SMTP' || process.env.SMS_SERVICE === 'GMAIL';
      
      if (!isSmtpService) {
        try {
          await smsService.sendSMS(contact.phoneNumber, `🚨 SOS ALERT from ${senderName}! They reported a ${type} emergency. Location: ${mapUrl}`);
          console.log(`[SOS Service] ✅ SMS sent successfully to ${contact.name}`);
        } catch (e) {
          console.error(`[SOS Service] ❌ Failed to send SMS to ${contact.name}:`, e);
        }
      }
      
      // 2. Send dedicated Email
      if (contact.email) {
        try {
          console.log(`[SOS Service] Sending SOS email to contact: ${contact.email}`);
          const emailSent = await sendEmail({
            to: contact.email,
            subject: `🚨 URGENT: SOS EMERGENCY ALERT - ${senderName} (${type})`,
            text: alertMessage,
             html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>SOS Emergency Alert</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    body{margin:0;padding:0;background-color:#121212;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif}
    .wrapper{width:100%;background-color:#121212;padding:20px 0}
    .card{max-width:560px;width:100%;margin:0 auto;background-color:#0a0a0a;border:2px solid #ff4b4b;border-radius:14px;overflow:hidden}
    .body-pad{padding:32px 28px}
    .title{margin:0 0 24px;color:#ff4b4b;font-size:28px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-align:center;line-height:1.2}
    .subtitle{font-size:16px;line-height:1.6;color:#ffffff;margin:0 0 22px}
    .name{color:#ff4b4b;font-weight:700}
    .divider{height:1px;background-color:#2a2a2a;margin-bottom:22px}
    .info-table{width:100%;border-collapse:collapse}
    .info-table td{padding:10px 0;vertical-align:top;font-size:14px}
    .info-label{color:#888888;font-weight:700;width:120px;white-space:nowrap}
    .info-value{color:#ffffff;padding-left:12px}
    .info-location{color:#3498db;padding-left:12px;line-height:1.5}
    .btn-wrap{margin-top:26px}
    .btn{display:block;width:100%;max-width:240px;background-color:#ff4b4b;color:#ffffff;padding:16px 20px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;text-transform:uppercase;text-align:center;box-sizing:border-box}
    .footer-divider{height:1px;background-color:#2a2a2a;margin:32px 0 20px}
    .footer{color:#555555;font-size:13px;line-height:1.5;margin:0}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="body-pad">
        <h1 class="title">🚨 SOS Emergency Alert</h1>
        <p class="subtitle">
          <span class="name">${senderName}</span> has triggered an SOS alert and needs immediate help.
        </p>
        <div class="divider"></div>
        <table class="info-table">
          <tr>
            <td class="info-label">Emergency Type:</td>
            <td class="info-value">${type}</td>
          </tr>
          <tr>
            <td class="info-label">Time:</td>
            <td class="info-value">${timestamp}</td>
          </tr>
          <tr>
            <td class="info-label">Location:</td>
            <td class="info-location">${finalAddress || 'Coordinates available below'}</td>
          </tr>
          <tr>
            <td class="info-label">Coordinates:</td>
            <td class="info-value">${latitude.toFixed(6)}, ${longitude.toFixed(6)}</td>
          </tr>
        </table>
        ${metadata?.message ? `
        <div style="margin:20px 0;padding:16px;background-color:#1a1a1a;border-left:4px solid #ff4b4b;border-radius:4px">
          <p style="margin:0 0 6px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px">User's Message</p>
          <p style="margin:0;color:#ffffff;font-size:15px;font-style:italic">"${metadata.message}"</p>
        </div>` : ''}
        <div class="btn-wrap">
          <a href="${mapUrl}" class="btn">View on Google Maps</a>
        </div>
        <div class="footer-divider"></div>
        <p class="footer">This is an automated emergency notification from the GUPIO SOS system.</p>
      </div>
    </div>
  </div>
</body>
</html>`
          });
          
          if (emailSent) {
            console.log(`[SOS Service] ✅ Email sent successfully to contact: ${contact.email}`);
          } else {
            console.error(`[SOS Service] ❌ Email helper returned false for: ${contact.email}`);
          }
        } catch (e) {
          console.error(`[SOS Service] ❌ Error in SOS Email loop for ${contact.email}:`, e);
        }
      } else {
        console.warn(`[SOS Service] ⚠️ Skipping email for ${contact.name} (No email address stored)`);
      }

      if (smsService.sendVoice) {
        try {
          await smsService.sendVoice(
            contact.phoneNumber,
            `This is an emergency alert from GUPIO. Your contact, ${senderName}, has reported a ${type} emergency. Please check your messages.`
          );
        } catch (e) {
          console.error(`[SOS Service] Voice alert failed for ${contact.name}:`, e);
        }
      }
    }

    // Always send a backup email to the sender's own email if available
    if (customer?.email) {
        console.log(`📧 Sending backup SOS email to user: ${customer.email}`);
        try {
           await sendEmail({
             to: customer.email,
             subject: `CONFIRMATION: Your SOS ALERT was triggered`,
             text: `SOS ALERT CONFIRMATION:\n\n${alertMessage}`,
             html: `
<div style="margin:0;padding:20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background-color:#121212">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#121212">
    <tr>
      <td align="center">
        <!-- Main Container with Gold Border -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color:#000000;border:2px solid #fbc02d;border-radius:12px;overflow:hidden">
          <!-- Body -->
          <tr>
            <td style="padding:40px 30px">
              <h1 style="margin:0 0 30px;color:#fbc02d;font-size:28px;text-transform:uppercase;letter-spacing:1px;text-align:center">✅ SOS Alert Confirmed</h1>
              
              <p style="font-size:18px;line-height:1.6;color:#ffffff;margin:0 0 25px">
                Your emergency alert has been broadcasted to your trusted contacts. <strong>Stay calm, help is on the way.</strong>
              </p>
              
              <div style="height:1px;background-color:#333333;margin-bottom:25px"></div>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom:15px;color:#888888;font-size:15px;width:140px;font-weight:bold">Emergency Type:</td>
                  <td style="padding-bottom:15px;color:#fbc02d;font-size:16px;font-weight:bold">${type}</td>
                </tr>
                <tr>
                  <td style="padding-bottom:15px;color:#888888;font-size:15px;font-weight:bold">Time:</td>
                  <td style="padding-bottom:15px;color:#ffffff;font-size:16px">${timestamp}</td>
                </tr>
                <tr>
                  <td style="padding-bottom:15px;color:#888888;font-size:15px;vertical-align:top;font-weight:bold">Location:</td>
                  <td style="padding-bottom:15px;color:#3498db;font-size:16px;line-height:1.4">${finalAddress || 'GPS Coordinates Shared'}</td>
                </tr>
              </table>

              <div style="margin-top:30px;padding:20px;border-top:1px dashed #333333;text-align:center">
                <p style="margin:0 0 10px;color:#888;font-size:14px">Real-time location link sent to contacts:</p>
                <a href="${mapUrl}" style="color:#fbc02d;text-decoration:underline;font-weight:bold;font-size:14px">${mapUrl}</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
            `
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
        type: keyword,
      },
      {
        name: `City ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} B`,
        address: "456 Safety Rd, Downtown",
        location: { lat: lat - 0.008, lng: lng + 0.002 },
        rating: 4.2,
        placeId: "mock_2",
        types: [keyword, "establishment"],
        type: keyword,
      },
    ];

    try {
      let keyword = "hospital";
      if (type === SOSType.POLICE) keyword = "police station";
      if (type === SOSType.MECHANICAL) keyword = "car repair";

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
        console.warn(`No Google Places results found for ${keyword}. Returning mock data.`);
        return getMockHelp(latitude, longitude, keyword);
      }

      console.log(`Google Places API returned ${response.data.results.length} results for ${keyword}.`);

      return response.data.results.map((place) => ({
        name: place.name,
        address: place.vicinity,
        location: place.geometry?.location,
        rating: place.rating,
        placeId: place.place_id,
        types: place.types,
        type: place.types?.[0] || keyword,
      }));
    } catch (error) {
      console.error("Google Maps API Error, falling back to mock:", error);
      let keyword = "hospital";
      if (type === SOSType.POLICE) keyword = "police station";
      if (type === SOSType.MECHANICAL) keyword = "car repair";
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
    console.log(`[SOS Service] 📥 Adding new contact for customer ${customerId}:`, data);
    const contact = await prisma.emergencyContact.create({
      data: {
        customerId,
        ...data,
      },
    });

    // 2. Send Welcome Email Notification
    if (data.email) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { fullName: true },
      });
      const senderName = customer?.fullName || "A user";

      console.log(`[SOS Service] Sending contact welcome email to: ${data.email}`);
      const welcomeMessage = `Hello ${data.name},\n\n${senderName} has added you as an emergency contact on GUPIO. 
\nThis means that if they trigger an SOS alert, you will receive an immediate notification with their real-time location and emergency details to help them.
\nNo action is needed from you right now. Thank you for being a trusted contact!`;

      try {
        await sendEmail({
          to: data.email,
          subject: `GUPIO: You've been added as an Emergency Contact for ${senderName}`,
          text: welcomeMessage,
          html: `
<div style="margin:0;padding:20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background-color:#121212">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#121212">
    <tr>
      <td align="center">
        <!-- Main Container with Amber Border -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color:#000000;border:2px solid #fbc02d;border-radius:12px;overflow:hidden">
          <!-- Body -->
          <tr>
            <td style="padding:40px 30px">
              <h1 style="margin:0 0 30px;color:#fbc02d;font-size:24px;text-transform:uppercase;letter-spacing:1px;text-align:center">GUPIO Safety Network</h1>
              
              <p style="font-size:18px;line-height:1.6;color:#ffffff;margin:0 0 20px">
                Hello <strong>${data.name}</strong>,
              </p>
              <p style="font-size:16px;line-height:1.6;color:#cccccc;margin:0 0 25px">
                <strong>${senderName}</strong> has added you as a trusted emergency contact on the <strong>GUPIO</strong> safety platform.
              </p>
              
              <div style="background-color:#1a1a1a;border:1px solid #333333;border-radius:8px;padding:25px;margin-bottom:30px">
                <h3 style="margin:0 0 15px;color:#ffffff;font-size:16px">Your Trusted Role:</h3>
                <ul style="margin:0;padding:0 0 0 20px;color:#cccccc;line-height:1.8;font-size:15px">
                  <li>Instant alerts if <strong>${senderName}</strong> is in danger.</li>
                  <li>Real-time GPS location tracking.</li>
                  <li>Emergency coordination tools.</li>
                </ul>
              </div>

              <p style="font-size:14px;color:#666666;margin:0;line-height:1.6;text-align:center">
                No action is required now. You are part of their safety network.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
          `
        });
      } catch (e) {
        console.error(`[SOS Service] Failed to send welcome email to ${data.email}:`, e);
      }
    }

    return contact;
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
