import axios from "axios";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError } from "../utils/AppError";

export const dlVerificationService = {
  async verifyDL(dlNumber: string, dob: string): Promise<any> {
    logger.info({ dlNumber, dob }, "Calling IDSPay DL verification API");

    // IDSPay structure usually expects specific casing or flat fields
    // Based on the user provided documentation:
    // POST /srv2/validation/dl
    // Request sample shows api_id, api_key, token_id. 
    // It doesn't show where dl_no goes, but Enterprise API V2 usually uses:
    const payload = {
      api_id: env.API_ID,
      api_key: env.API_KEY,
      token_id: env.TOKEN_ID,
      dlNumber: dlNumber,
      dob: dob, 
    };

    try {
      const response = await axios.post(
        "https://javabackend.idspay.in/api/v1/prod/srv2/validation/dl",
        payload,
        // Reachable from the agent's verify_dl flow, which runs inside a user turn — an
        // unbounded call here holds that turn open with no ceiling.
        { timeout: 20_000 }
      );

      const data = response.data;

      // Success check: status code 200 means successful validation
      const statusCode = data.status?.code || data.code;
      if (statusCode !== 200 || !data.data) {
        logger.error({ response: data }, "DL verification API returned error status");
        throw AppError.badRequest(data.status?.message || data.message || "No record found, Invalid DL number");
      }

      return data.data;
    } catch (error: any) {
      if (error.response?.data) {
        logger.error({ idspayError: error.response.data }, "IDSPay API error response body");
      }
      if (error instanceof AppError) throw error;
      logger.error({ error: error.message, dlNumber }, "DL verification API call failed");
      throw AppError.internal(error.response?.data?.message || "DL verification service unavailable");
    }
  },
};
