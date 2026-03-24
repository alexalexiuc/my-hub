CREATE TABLE IF NOT EXISTS "trip_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"trip_id" integer NOT NULL,
	"shared_with_user_id" uuid NOT NULL,
	"permission" text DEFAULT 'view' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_documents" ADD COLUMN "booking_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_shares" ADD CONSTRAINT "trip_shares_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_shares" ADD CONSTRAINT "trip_shares_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_shares" ADD CONSTRAINT "trip_shares_shared_with_user_id_users_id_fk" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_trip_shares_owner_trip_shared_with" ON "trip_shares" ("owner_user_id","trip_id","shared_with_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_shares_trip_id" ON "trip_shares" ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_shares_shared_with_user_id" ON "trip_shares" ("shared_with_user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_documents" ADD CONSTRAINT "trip_documents_booking_id_trip_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."trip_bookings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_documents_booking_id" ON "trip_documents" ("booking_id");