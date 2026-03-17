import { CustomerPayload } from "../modules/auth/auth.types";
import type { AdminPayload } from "../modules/admin/admin.types";

declare global {
  namespace Express {
    interface Request {
      customer?: CustomerPayload;
      admin?: AdminPayload;
    }
  }
}
