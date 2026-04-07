import axios from "axios";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError } from "../utils/AppError";

export interface RCVerificationResponse {
  status: {
    code: number;
    type: string;
    message: string;
  } | string;
  data?: any;
  message?: string;
}

export const rcVerificationService = {
  async verifyRC(regNo: string): Promise<any> {
    logger.info({ regNo }, "Calling third-party RC verification API");

    const payload = {
      api_id: env.API_ID,
      api_key: env.API_KEY,
      token_id: env.TOKEN_ID,
      reg_no: regNo,
    };

    try {
      const response = await axios.post<RCVerificationResponse>(
        "https://javabackend.idspay.in/api/v1/prod/srv2/validation/rc",
        payload
      );

      const resStatus = response.data.status;
      const isSuccess = typeof resStatus === 'string' 
        ? resStatus === 'success' 
        : resStatus?.type === 'success';

      if (!isSuccess || !response.data.data) {
        logger.error({ response: response.data }, "RC verification API returned error");
        throw AppError.badRequest(response.data.message || "Failed to verify RC");
      }

      const data = response.data.data;
      console.log('RC Verification API Raw Data:', JSON.stringify(data, null, 2));

      // Map API keys to our internal structure (matching CustomerVehicle model exactly)
      const mappedData: any = {
        registrationNumber: data.reg_no,
        ownerName: data.owner_name,
        rto: data.reg_authority || data.rto,
        make: data.vehicle_manufacturer_name || data.make,
        brand: data.vehicle_manufacturer_name || data.make,
        model: data.model,
        vehicleClass: data.class || data.vehicle_class,
        engineNumber: data.engine || data.engine_no,
        chassisNumber: data.chassis || data.chassis_no,
        fuelType: (() => {
          const raw = (data.type || data.fuel_type || "").toUpperCase();
          if (raw.includes("PETROL")) return "PETROL";
          if (raw.includes("DIESEL")) return "DIESEL";
          if (raw.includes("CNG")) return "CNG";
          if (raw.includes("EV") || raw.includes("ELECTRIC")) return "EV";
          if (raw.includes("HYBRID")) return "HYBRID";
          return "OTHER";
        })(),
        fuelNorms: data.norms_type || data.fuel_norms,
        rcStatus: data.status || data.rc_status,
        unloadedWeight: data.unladen_weight || data.unloaded_weight,
        registrationDate: (() => {
          const d = data.reg_date || "";
          if (d.includes("-")) {
            const [day, month, year] = d.split("-");
            return `${year}-${month}-${day}`;
          }
          return d;
        })(),
        fitnessUpto: data.rc_expiry_date || data.fitness_upto,
        insuranceUpto: data.vehicle_insurance_upto || data.insurance_upto,
        pollutionUpto:
          data.pollution_upto ||
          data.puc_upto ||
          data.vehicle_pollution_upto ||
          data.puc_expiry,
        mileage: data.mileage || 'N/A',
        color: data.vehicle_colour,
        manufacturingMonthYear: data.vehicle_manufacturing_month_year,
        vehicleType: data.vehicle_type || 'CAR'
      };

      // Inference for vehicleType if not provided
      if (!data.vehicle_type) {
        const vc = (mappedData.vehicleClass || "").toLowerCase();
        if (vc.includes("cycle") || vc.includes("scooter") || vc.includes("moped") || vc.includes("bike") || vc.includes("2wn")) {
          mappedData.vehicleType = "BIKE";
        } else {
          mappedData.vehicleType = "CAR";
        }
      }

      return mappedData;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error({ error: error.message, regNo }, "RC verification API call failed");
      throw AppError.internal("RC verification service unavailable");
    }
  },
};
