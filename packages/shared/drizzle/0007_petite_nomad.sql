ALTER TYPE "mcp_server" ADD VALUE 'apiary';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "apiary_hives" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"yard_id" integer,
	"name" text NOT NULL,
	"queen_status" text,
	"queen_marked" boolean,
	"queen_year" integer,
	"boxes" integer,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "apiary_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"hive_id" integer,
	"logged_at" timestamp DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"notes" text,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "apiary_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"hive_id" integer,
	"yard_id" integer,
	"title" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"due_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "apiary_yards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apiary_hives" ADD CONSTRAINT "apiary_hives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apiary_hives" ADD CONSTRAINT "apiary_hives_yard_id_apiary_yards_id_fk" FOREIGN KEY ("yard_id") REFERENCES "public"."apiary_yards"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apiary_logs" ADD CONSTRAINT "apiary_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apiary_logs" ADD CONSTRAINT "apiary_logs_hive_id_apiary_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."apiary_hives"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apiary_tasks" ADD CONSTRAINT "apiary_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apiary_tasks" ADD CONSTRAINT "apiary_tasks_hive_id_apiary_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."apiary_hives"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apiary_tasks" ADD CONSTRAINT "apiary_tasks_yard_id_apiary_yards_id_fk" FOREIGN KEY ("yard_id") REFERENCES "public"."apiary_yards"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apiary_yards" ADD CONSTRAINT "apiary_yards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
