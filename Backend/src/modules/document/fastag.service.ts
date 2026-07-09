import axios from "axios";
import { logger } from "../../config/logger";
import { AppError } from "../../utils/AppError";
import { env } from "../../config/env";

const BASE_URL = "https://javabackend.idspay.in/api/v1/prod";

export const fastagVerificationService = {
  /**
   * Bank/Fastag Account Verification (Penny Less V2)
   * IDSPay Endpoint: /idfc/beneficiary
   */
  async verifyAccount(creditorAccountId: string, ifscCode: string) {
    try {
      const payload = {
        api_id: env.API_ID,
        api_key: env.API_KEY,
        token_id: env.TOKEN_ID,
        creditorAccountId,
        ifscCode,
      };

      logger.info({ creditorAccountId }, "Requesting Bank/Fastag Verification from IDSPay");

      const response = await axios.post(`${BASE_URL}/idfc/beneficiary`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      const result = response.data;
      const metaStatus = result.data?.beneValidationResp?.metaData?.status;

      if ((result.status?.code === 200 || result.status?.type === "success") && metaStatus !== "Failed") {
        return result;
      } else {
        const failureMsg = result.message || result.status?.message || "Beneficiary validation Failed";
        throw new AppError(failureMsg, 422);
      }
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      
      const errMsg = error.response?.data?.message || error.message || "IDSPay API Error";
      logger.error({ error: errMsg }, "Fastag Verification API Error");
      throw new AppError(errMsg, error.response?.status || 500);
    }
  },
};
