DO $$ BEGIN
 CREATE TYPE "public"."mcp_server" AS ENUM('calories', 'hive', 'products');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text,
	"google_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text NOT NULL,
	"token_signing_secret" jsonb NOT NULL,
	"user_id" uuid,
	"client_name" text,
	"redirect_uris" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_clients_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_servers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"server_name" "mcp_server" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_mcp_user_server" UNIQUE("user_id","server_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hive_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"hive_id" integer NOT NULL,
	"logged_at" timestamp DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"notes" text,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hive_todos" (
	"id" serial PRIMARY KEY NOT NULL,
	"hive_id" integer,
	"title" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"due_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hives" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calorie_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text,
	"age" integer,
	"height_cm" real,
	"weight_kg" real,
	"sex" text,
	"activity_level" text,
	"goal_calories_override" integer,
	"neck_cm" real,
	"waist_cm" real,
	"hips_cm" real,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "calorie_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meal_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"meal_id" text,
	"user_id" uuid NOT NULL,
	"date" text NOT NULL,
	"logged_at" timestamp DEFAULT now() NOT NULL,
	"meal_type" text NOT NULL,
	"description" text NOT NULL,
	"kcal" integer,
	"protein" real,
	"carbs" real,
	"fat" real,
	"notes" text,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meal_logs_meal_id_unique" UNIQUE("meal_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_request_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"service" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status_code" integer,
	"duration_ms" integer,
	"ip" "inet",
	"user_id" uuid,
	"request_body" jsonb,
	"response_body" jsonb,
	"error" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hive_logs" ADD CONSTRAINT "hive_logs_hive_id_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."hives"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hive_todos" ADD CONSTRAINT "hive_todos_hive_id_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."hives"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calorie_profiles" ADD CONSTRAINT "calorie_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meal_logs_user" ON "meal_logs" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meal_logs_date" ON "meal_logs" ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meal_logs_user_date" ON "meal_logs" ("user_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logs_created_at" ON "api_request_logs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logs_path" ON "api_request_logs" ("path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logs_user" ON "api_request_logs" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logs_status" ON "api_request_logs" ("status_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logs_service" ON "api_request_logs" ("service");