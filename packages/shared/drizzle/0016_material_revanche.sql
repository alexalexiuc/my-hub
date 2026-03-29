CREATE TABLE IF NOT EXISTS "flight_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"flight_number" text NOT NULL,
	"flight_date" date NOT NULL,
	"origin_iata" text,
	"destination_iata" text,
	"scheduled_departure_at" timestamp,
	"scheduled_arrival_at" timestamp,
	"actual_departure_at" timestamp,
	"actual_arrival_at" timestamp,
	"departure_terminal" text,
	"departure_gate" text,
	"arrival_terminal" text,
	"status" text,
	"aircraft_type" text,
	"aircraft_registration" text,
	"airline_iata" text,
	"airline_name" text,
	"last_fetched_at" timestamp,
	"next_fetch_at" timestamp NOT NULL,
	"auto_update_enabled" boolean DEFAULT true NOT NULL,
	"raw_response" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_bookings" ADD COLUMN "flight_data_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_flight_data_number_date" ON "flight_data" ("flight_number","flight_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_flight_data_next_fetch_at" ON "flight_data" ("next_fetch_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_bookings" ADD CONSTRAINT "trip_bookings_flight_data_id_flight_data_id_fk" FOREIGN KEY ("flight_data_id") REFERENCES "public"."flight_data"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
