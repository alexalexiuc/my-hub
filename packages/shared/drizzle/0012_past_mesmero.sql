ALTER TYPE "mcp_server" ADD VALUE 'travel';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"trip_id" integer NOT NULL,
	"booking_type" text NOT NULL,
	"title" text NOT NULL,
	"provider" text,
	"confirmation_number" text,
	"start_at" timestamp,
	"end_at" timestamp,
	"status" text,
	"cost_amount" real,
	"cost_currency" text DEFAULT 'EUR' NOT NULL,
	"location" text,
	"notes" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_checklist_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"trip_id" integer NOT NULL,
	"title" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_companions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"trip_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"trip_id" integer NOT NULL,
	"type" text DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"source_url" text,
	"original_name" text,
	"mime_type" text,
	"byte_size" integer,
	"storage_path" text,
	"public_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_places" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"trip_id" integer NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"notes" text,
	"visited" boolean DEFAULT false NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trips" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"destination" text,
	"start_at" timestamp,
	"end_at" timestamp,
	"status" text DEFAULT 'planned' NOT NULL,
	"notes" text,
	"cover_image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_bookings" ADD CONSTRAINT "trip_bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_bookings" ADD CONSTRAINT "trip_bookings_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_checklist_items" ADD CONSTRAINT "trip_checklist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_checklist_items" ADD CONSTRAINT "trip_checklist_items_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_companions" ADD CONSTRAINT "trip_companions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_companions" ADD CONSTRAINT "trip_companions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_documents" ADD CONSTRAINT "trip_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_documents" ADD CONSTRAINT "trip_documents_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_places" ADD CONSTRAINT "trip_places_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_places" ADD CONSTRAINT "trip_places_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_bookings_trip_id" ON "trip_bookings" ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_bookings_user_id" ON "trip_bookings" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_bookings_start_at" ON "trip_bookings" ("start_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_checklist_items_trip_id" ON "trip_checklist_items" ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_checklist_items_user_id" ON "trip_checklist_items" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_companions_trip_id" ON "trip_companions" ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_companions_user_id" ON "trip_companions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_documents_trip_id" ON "trip_documents" ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_documents_user_id" ON "trip_documents" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_places_trip_id" ON "trip_places" ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_places_user_id" ON "trip_places" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trips_user_id" ON "trips" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trips_start_at" ON "trips" ("start_at");