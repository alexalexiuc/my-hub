CREATE TABLE IF NOT EXISTS "trip_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"trip_id" integer NOT NULL,
	"date" date NOT NULL,
	"title" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_bookings" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "trip_bookings" ADD COLUMN "lat" real;--> statement-breakpoint
ALTER TABLE "trip_bookings" ADD COLUMN "lng" real;--> statement-breakpoint
ALTER TABLE "trip_places" ADD COLUMN "lat" real;--> statement-breakpoint
ALTER TABLE "trip_places" ADD COLUMN "lng" real;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_days" ADD CONSTRAINT "trip_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_days" ADD CONSTRAINT "trip_days_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_trip_days_trip_date" ON "trip_days" ("trip_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_days_trip_id" ON "trip_days" ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_days_user_id" ON "trip_days" ("user_id");