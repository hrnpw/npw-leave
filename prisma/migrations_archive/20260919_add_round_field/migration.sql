-- Add round column to leaves table with default value 1 for existing rows
ALTER TABLE "leaves" ADD COLUMN "round" INTEGER;
UPDATE "leaves" SET "round" = 1 WHERE "round" IS NULL;
ALTER TABLE "leaves" ALTER COLUMN "round" SET NOT NULL;

-- Add round column to fiscal_counter table with default value 1 for existing rows
ALTER TABLE "fiscal_counter" ADD COLUMN "round" INTEGER;
UPDATE "fiscal_counter" SET "round" = 1 WHERE "round" IS NULL;
ALTER TABLE "fiscal_counter" ALTER COLUMN "round" SET NOT NULL;

-- Drop the old primary key and create new composite primary key
ALTER TABLE "fiscal_counter" DROP CONSTRAINT "fiscal_counter_pkey";
ALTER TABLE "fiscal_counter" ADD CONSTRAINT "fiscal_counter_pkey" PRIMARY KEY ("fiscal_year", "round");

-- Create unique constraint on leaves table for fiscal_year, round, running_no
CREATE UNIQUE INDEX "leaves_fiscal_year_round_running_no_key" ON "leaves"("fiscal_year", "round", "running_no");