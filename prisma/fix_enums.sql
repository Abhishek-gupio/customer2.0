ALTER TYPE "customer"."TicketCategory" ADD VALUE IF NOT EXISTS 'DOCUMENTS';
ALTER TYPE "customer"."TicketCategory" ADD VALUE IF NOT EXISTS 'VALET';
ALTER TYPE "customer"."TicketCategory" ADD VALUE IF NOT EXISTS 'AI_ASSISTANT';
ALTER TYPE "customer"."TicketCategory" ADD VALUE IF NOT EXISTS 'ACCOUNT';
ALTER TABLE "customer"."SupportTicket" ALTER COLUMN "category" SET DEFAULT 'OTHER'::"customer"."TicketCategory";
