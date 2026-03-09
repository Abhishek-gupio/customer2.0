/*
  Warnings:

  - You are about to drop the `PartReplacementInterval` table. If the table is not empty, all the data it contains will be lost.

*/
CREATE SCHEMA IF NOT EXISTS "customer";
SET search_path TO "customer";

-- DropTable
DROP TABLE IF EXISTS "PartReplacementInterval";
