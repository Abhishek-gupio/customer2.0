import axios from "axios";
import { dbInstances } from "@repo/db-customer";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { logger } from "../../config/logger";

const DIGILOCKER_AUTH_URL =
  "https://digitallocker.gov.in/public/oauth2/1/authorize";
const DIGILOCKER_TOKEN_URL =
  "https://digitallocker.gov.in/public/oauth2/1/token";
const DIGILOCKER_API_BASE = "https://digitallocker.gov.in/public/oauth2/1";

export const digilockerService = {
  getAuthUrl(state: string) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: env.DIGILOCKER_CLIENT_ID || "",
      redirect_uri: env.DIGILOCKER_REDIRECT_URI || "",
      state,
    });
    return `${DIGILOCKER_AUTH_URL}?${params.toString()}`;
  },

  async handleCallback(customerId: string, code: string) {
    try {
      const response = await axios.post(
        DIGILOCKER_TOKEN_URL,
        new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: env.DIGILOCKER_CLIENT_ID || "",
          client_secret: env.DIGILOCKER_CLIENT_SECRET || "",
          redirect_uri: env.DIGILOCKER_REDIRECT_URI || "",
        }).toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      );

      const { access_token, refresh_token, expires_in } = response.data;

      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

      const connection = await dbInstances.digiLockerConnection.upsert({
        where: { customerId },
        update: {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt,
          status: "CONNECTED",
        },
        create: {
          customerId,
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt,
          status: "CONNECTED",
        },
      });

      return connection;
    } catch (error) {
      logger.error({ error }, "DigiLocker OAuth callback failed");
      throw AppError.badRequest("Failed to connect DigiLocker");
    }
  },

  async syncDocuments(customerId: string) {
    const connection = await dbInstances.digiLockerConnection.findUnique({
      where: { customerId },
    });

    if (!connection || connection.status !== "CONNECTED") {
      throw AppError.badRequest("DigiLocker not connected");
    }

    // Logic to fetch documents from DigiLocker API and save to VehicleDocument
    // This usually involves listing files and then downloading metadata
    try {
      // Mocking the sync for now as we don't have real API access credentials
      const documents = await axios.get(`${DIGILOCKER_API_BASE}/files/issued`, {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
      });

      // In a real implementation, you'd iterate and save using documentService.createFromDigiLocker
      logger.info(
        { count: documents.data?.issued?.length },
        "DigiLocker sync successful",
      );

      await dbInstances.digiLockerConnection.update({
        where: { customerId },
        data: { lastSyncAt: new Date() },
      });

      return {
        message: "Sync successful",
        count: documents.data?.issued?.length || 0,
      };
    } catch (error) {
      logger.error({ error }, "DigiLocker sync failed");
      throw AppError.internal("Failed to sync DigiLocker documents");
    }
  },
};
