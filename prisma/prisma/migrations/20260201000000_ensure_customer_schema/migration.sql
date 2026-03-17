-- Ensure the customer schema exists so later migrations can use it.
-- Shadow DB and fresh DBs have no schema until this runs.
CREATE SCHEMA IF NOT EXISTS "customer";
