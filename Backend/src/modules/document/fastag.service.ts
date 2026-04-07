import axios from "axios";
import { logger } from "../../config/logger";
import { AppError } from "../../utils/AppError";

const BASE_URL = "https://javabackend.idspay.in/api/v1/prod";
const API_ID = "APID1557";
const API_KEY = "f145878d-19f0-4854-b53f-39764c159687";
const TOKEN_ID = "3nvyL2c5zCsZQaJsaoHTRu3qD1XHgB0E";

export const fastagVerificationService = {
  /**
   * Bank/Fastag Account Verification (Penny Less V2)
   * IDSPay Endpoint: /idfc/beneficiary
   */
  async verifyAccount(creditorAccountId: string, ifscCode: string) {
    try {
      const payload = {
        api_id: API_ID,
        api_key: API_KEY,
        token_id: TOKEN_ID,
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
