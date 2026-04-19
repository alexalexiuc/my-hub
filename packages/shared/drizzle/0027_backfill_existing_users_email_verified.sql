-- Backfill: mark all pre-existing users as email-verified.
-- New users registered via form will start unverified (email_verified = false by default).
-- Existing users are already active in the system, so we treat their emails as implicitly verified.
-- Google-OAuth users will also be set to verified here; going forward they are set verified at sign-up.
UPDATE "users" SET "email_verified" = true;