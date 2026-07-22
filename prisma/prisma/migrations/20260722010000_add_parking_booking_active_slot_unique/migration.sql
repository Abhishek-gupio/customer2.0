-- Prevents two non-terminal (still-live) bookings for the same customer +
-- listing + exact time window from ever coexisting, at the database level.
-- The application-level check in createBooking (a plain SELECT before the
-- INSERT) closes this for sequential requests but has a genuine race window
-- for truly concurrent ones — this index is the actual backstop. Partial
-- (WHERE-scoped) unique indexes aren't expressible via Prisma's `@@unique`
-- in the schema DSL, so this one is hand-written, same as other structural
-- changes already applied outside `prisma migrate` in this project's history.
CREATE UNIQUE INDEX "ParkingBooking_active_slot_unique_idx"
ON "customer"."ParkingBooking" ("customerId", "listingId", "startTime", "endTime")
WHERE "status" IN ('PENDING_PAYMENT', 'CONFIRMED');
