ALTER TABLE "trips" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "trips" DROP COLUMN IF EXISTS "status";