import { CustomerPayload } from "../modules/auth/auth.types";
import type { AdminPayload } from "../modules/admin/admin.types";
import type { DealerPayload } from "../modules/parking/parking.types";
import type { PartnerPayload, TechnicianPayload } from "../modules/carwash/carwash.types";

declare global {
  namespace Express {
    interface Request {
      customer?: CustomerPayload;
      admin?: AdminPayload;
      dealer?: DealerPayload;
      partner?: PartnerPayload;
      technician?: TechnicianPayload;
      /** Raw request body bytes, captured by app.ts's express.json `verify` hook — needed for Razorpay webhook signature verification. */
      rawBody?: Buffer;
    }
  }
}
