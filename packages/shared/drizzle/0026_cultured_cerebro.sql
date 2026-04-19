ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "failed_login_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "failed_reset_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blocked_at" timestamp;

-- Backfill: mark all pre-existing users as email-verified.
-- New users registered via form will start unverified (email_verified = false by default).
-- Existing users are already active in the system, so we treat their emails as implicitly verified.
-- Google-OAuth users will also be set to verified here; going forward they are set verified at sign-up.
UPDATE "users" SET "email_verified" = true;
