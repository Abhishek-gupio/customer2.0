-- The retroactive migration (20260720070000) assumed SettlementStatus was
-- ('PENDING', 'COMPLETED') to match schema.prisma, but the DB actually had
-- ('PENDING', 'PAID', 'FAILED') from whatever process applied it out-of-band.
-- ParkingSettlement has 0 rows, so this is a safe, lossless conversion.
BEGIN;
CREATE TYPE "customer"."SettlementStatus_new" AS ENUM ('PENDING', 'COMPLETED');
ALTER TABLE "customer"."ParkingSettlement" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "customer"."ParkingSettlement" ALTER COLUMN "status" TYPE "customer"."SettlementStatus_new" USING ("status"::text::"customer"."SettlementStatus_new");
ALTER TYPE "customer"."SettlementStatus" RENAME TO "SettlementStatus_old";
ALTER TYPE "customer"."SettlementStatus_new" RENAME TO "SettlementStatus";
DROP TYPE "customer"."SettlementStatus_old";
ALTER TABLE "customer"."ParkingSettlement" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
