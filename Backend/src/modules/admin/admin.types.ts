import type { AdminRole } from "@repo/db-customer";

export interface AdminPayload {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
}
