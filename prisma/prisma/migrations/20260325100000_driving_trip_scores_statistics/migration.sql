-- DrivingTrip: align DB with schema (Prisma Json? fields were missing from initial table)
ALTER TABLE "customer"."DrivingTrip" ADD COLUMN IF NOT EXISTS "scores" JSONB;
ALTER TABLE "customer"."DrivingTrip" ADD COLUMN IF NOT EXISTS "statistics" JSONB;
