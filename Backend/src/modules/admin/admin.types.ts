import type { AdminRole } from "@repo/db-customer";

export interface AdminPayload {
  id: string;
  email: string;
  role: AdminRole;
}
