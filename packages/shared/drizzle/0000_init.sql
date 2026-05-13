CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text,
	"google_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"country" text,
	"timezone" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"blocked_at" timestamp,
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
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_clients_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_servers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"server_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_mcp_user_server" UNIQUE("user_id","server_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calorie_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"age" integer,
	"sex" text,
	"height_cm" real,
	"activity_level" text,
	"goal_type" text,
	"goal_weekly_rate_kg" real,
	"goal_min_calories" integer,
	"goal_max_calories" integer,
	"goal_protein" real,
	"goal_carbs" real,
	"goal_fat" real,
	"notes" text,
	"automation_api_key" text,
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
CREATE TABLE IF NOT EXISTS "body_measurements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type_key" text NOT NULL,
	"date" text NOT NULL,
	"value" real NOT NULL,
	"notes" text,
	"entry_source" text DEFAULT 'hub' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_request_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"service" text NOT NULL,
	"server" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status_code" integer,
	"duration_ms" integer,
	"ip" "inet",
	"user_id" uuid,
	"client_id" text,
	"request_body" jsonb,
	"response_body" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "todos" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invite_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"created_by" uuid NOT NULL,
	"used_by" uuid,
	"used_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invite_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
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
	"finished" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"reference_link" text,
	"notes" text,
	"details" jsonb,
	"flight_data_id" integer,
	"timezone" text,
	"lat" real,
	"lng" real,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
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
CREATE TABLE IF NOT EXISTS "trip_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"trip_id" integer NOT NULL,
	"booking_id" integer,
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
	"lat" real,
	"lng" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE IF NOT EXISTS "trips" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3B82F6' NOT NULL,
	"destination" text,
	"start_at" timestamp,
	"end_at" timestamp,
	"cancelled_at" timestamp,
	"notes" text,
	"cover_image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_key" text NOT NULL,
	"subscribed" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"currency" text NOT NULL,
	"opening_balance" numeric(18, 4) DEFAULT 0 NOT NULL,
	"balance" numeric(18, 4) DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_budget_members" (
	"budget_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "finance_budget_members_budget_id_user_id_pk" PRIMARY KEY("budget_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"default_currency" text DEFAULT 'MDL' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"name" text NOT NULL,
	"group_id" integer,
	"color" text,
	"icon" text,
	"notes" text,
	"monthly_target" numeric(18, 4),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_currency_rates" (
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"date" date NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_currency_rates_from_currency_to_currency_date_pk" PRIMARY KEY("from_currency","to_currency","date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"row_count" integer NOT NULL,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_monthly_plan_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(18, 4) NOT NULL,
	"currency" text NOT NULL,
	"category_id" integer,
	"merchant_id" integer,
	"linked_account_id" integer,
	"assigned_amount" numeric(18, 4) DEFAULT 0 NOT NULL,
	"is_assigned" boolean DEFAULT false NOT NULL,
	"assigned_transaction_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_monthly_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"month" text NOT NULL,
	"available_amount" numeric(18, 4) NOT NULL,
	"income_account_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_net_worth_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"month" text NOT NULL,
	"total_assets" numeric(18, 4) NOT NULL,
	"total_liabilities" numeric(18, 4) NOT NULL,
	"net_worth" numeric(18, 4) NOT NULL,
	"breakdown" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_payees" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"name" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"normalized_name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"type" text NOT NULL,
	"account_id" integer NOT NULL,
	"to_account_id" integer,
	"amount" numeric(18, 4) NOT NULL,
	"exchange_rate" numeric(18, 8) DEFAULT 1 NOT NULL,
	"to_exchange_rate" numeric(18, 8),
	"date" date NOT NULL,
	"category_id" integer,
	"payee_id" integer,
	"notes" text,
	"extras" jsonb,
	"is_correction" boolean DEFAULT false NOT NULL,
	"from_account_balance_after" numeric(18, 4),
	"to_account_balance_after" numeric(18, 4),
	"source" text DEFAULT 'hub' NOT NULL,
	"added_by_user_id" uuid NOT NULL,
	"import_batch_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_clients" DROP CONSTRAINT IF EXISTS "oauth_clients_user_id_users_id_fk";
ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" DROP CONSTRAINT IF EXISTS "oauth_refresh_tokens_client_id_oauth_clients_client_id_fk";
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" DROP CONSTRAINT IF EXISTS "oauth_refresh_tokens_user_id_users_id_fk";
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_servers" DROP CONSTRAINT IF EXISTS "mcp_servers_user_id_users_id_fk";
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calorie_profiles" DROP CONSTRAINT IF EXISTS "calorie_profiles_user_id_users_id_fk";
ALTER TABLE "calorie_profiles" ADD CONSTRAINT "calorie_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_logs" DROP CONSTRAINT IF EXISTS "meal_logs_user_id_users_id_fk";
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_measurements" DROP CONSTRAINT IF EXISTS "body_measurements_user_id_users_id_fk";
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_request_logs" DROP CONSTRAINT IF EXISTS "api_request_logs_client_id_oauth_clients_client_id_fk";
ALTER TABLE "api_request_logs" ADD CONSTRAINT "api_request_logs_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" DROP CONSTRAINT IF EXISTS "todos_user_id_users_id_fk";
ALTER TABLE "todos" ADD CONSTRAINT "todos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_tokens" DROP CONSTRAINT IF EXISTS "invite_tokens_created_by_users_id_fk";
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_tokens" DROP CONSTRAINT IF EXISTS "invite_tokens_used_by_users_id_fk";
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apiary_hives" DROP CONSTRAINT IF EXISTS "apiary_hives_user_id_users_id_fk";
ALTER TABLE "apiary_hives" ADD CONSTRAINT "apiary_hives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apiary_hives" DROP CONSTRAINT IF EXISTS "apiary_hives_yard_id_apiary_yards_id_fk";
ALTER TABLE "apiary_hives" ADD CONSTRAINT "apiary_hives_yard_id_apiary_yards_id_fk" FOREIGN KEY ("yard_id") REFERENCES "public"."apiary_yards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apiary_logs" DROP CONSTRAINT IF EXISTS "apiary_logs_user_id_users_id_fk";
ALTER TABLE "apiary_logs" ADD CONSTRAINT "apiary_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apiary_logs" DROP CONSTRAINT IF EXISTS "apiary_logs_hive_id_apiary_hives_id_fk";
ALTER TABLE "apiary_logs" ADD CONSTRAINT "apiary_logs_hive_id_apiary_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."apiary_hives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apiary_tasks" DROP CONSTRAINT IF EXISTS "apiary_tasks_user_id_users_id_fk";
ALTER TABLE "apiary_tasks" ADD CONSTRAINT "apiary_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apiary_tasks" DROP CONSTRAINT IF EXISTS "apiary_tasks_hive_id_apiary_hives_id_fk";
ALTER TABLE "apiary_tasks" ADD CONSTRAINT "apiary_tasks_hive_id_apiary_hives_id_fk" FOREIGN KEY ("hive_id") REFERENCES "public"."apiary_hives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apiary_tasks" DROP CONSTRAINT IF EXISTS "apiary_tasks_yard_id_apiary_yards_id_fk";
ALTER TABLE "apiary_tasks" ADD CONSTRAINT "apiary_tasks_yard_id_apiary_yards_id_fk" FOREIGN KEY ("yard_id") REFERENCES "public"."apiary_yards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apiary_yards" DROP CONSTRAINT IF EXISTS "apiary_yards_user_id_users_id_fk";
ALTER TABLE "apiary_yards" ADD CONSTRAINT "apiary_yards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_bookings" DROP CONSTRAINT IF EXISTS "trip_bookings_user_id_users_id_fk";
ALTER TABLE "trip_bookings" ADD CONSTRAINT "trip_bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_bookings" DROP CONSTRAINT IF EXISTS "trip_bookings_trip_id_trips_id_fk";
ALTER TABLE "trip_bookings" ADD CONSTRAINT "trip_bookings_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_bookings" DROP CONSTRAINT IF EXISTS "trip_bookings_flight_data_id_flight_data_id_fk";
ALTER TABLE "trip_bookings" ADD CONSTRAINT "trip_bookings_flight_data_id_flight_data_id_fk" FOREIGN KEY ("flight_data_id") REFERENCES "public"."flight_data"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_checklist_items" DROP CONSTRAINT IF EXISTS "trip_checklist_items_user_id_users_id_fk";
ALTER TABLE "trip_checklist_items" ADD CONSTRAINT "trip_checklist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_checklist_items" DROP CONSTRAINT IF EXISTS "trip_checklist_items_trip_id_trips_id_fk";
ALTER TABLE "trip_checklist_items" ADD CONSTRAINT "trip_checklist_items_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_companions" DROP CONSTRAINT IF EXISTS "trip_companions_user_id_users_id_fk";
ALTER TABLE "trip_companions" ADD CONSTRAINT "trip_companions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_companions" DROP CONSTRAINT IF EXISTS "trip_companions_trip_id_trips_id_fk";
ALTER TABLE "trip_companions" ADD CONSTRAINT "trip_companions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_days" DROP CONSTRAINT IF EXISTS "trip_days_user_id_users_id_fk";
ALTER TABLE "trip_days" ADD CONSTRAINT "trip_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_days" DROP CONSTRAINT IF EXISTS "trip_days_trip_id_trips_id_fk";
ALTER TABLE "trip_days" ADD CONSTRAINT "trip_days_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_documents" DROP CONSTRAINT IF EXISTS "trip_documents_user_id_users_id_fk";
ALTER TABLE "trip_documents" ADD CONSTRAINT "trip_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_documents" DROP CONSTRAINT IF EXISTS "trip_documents_trip_id_trips_id_fk";
ALTER TABLE "trip_documents" ADD CONSTRAINT "trip_documents_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_documents" DROP CONSTRAINT IF EXISTS "trip_documents_booking_id_trip_bookings_id_fk";
ALTER TABLE "trip_documents" ADD CONSTRAINT "trip_documents_booking_id_trip_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."trip_bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_places" DROP CONSTRAINT IF EXISTS "trip_places_user_id_users_id_fk";
ALTER TABLE "trip_places" ADD CONSTRAINT "trip_places_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_places" DROP CONSTRAINT IF EXISTS "trip_places_trip_id_trips_id_fk";
ALTER TABLE "trip_places" ADD CONSTRAINT "trip_places_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_shares" DROP CONSTRAINT IF EXISTS "trip_shares_owner_user_id_users_id_fk";
ALTER TABLE "trip_shares" ADD CONSTRAINT "trip_shares_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_shares" DROP CONSTRAINT IF EXISTS "trip_shares_trip_id_trips_id_fk";
ALTER TABLE "trip_shares" ADD CONSTRAINT "trip_shares_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_shares" DROP CONSTRAINT IF EXISTS "trip_shares_shared_with_user_id_users_id_fk";
ALTER TABLE "trip_shares" ADD CONSTRAINT "trip_shares_shared_with_user_id_users_id_fk" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" DROP CONSTRAINT IF EXISTS "trips_user_id_users_id_fk";
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" DROP CONSTRAINT IF EXISTS "notification_preferences_user_id_users_id_fk";
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT IF EXISTS "password_reset_tokens_user_id_users_id_fk";
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_accounts" DROP CONSTRAINT IF EXISTS "finance_accounts_budget_id_finance_budgets_id_fk";
ALTER TABLE "finance_accounts" ADD CONSTRAINT "finance_accounts_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_budget_members" DROP CONSTRAINT IF EXISTS "finance_budget_members_budget_id_finance_budgets_id_fk";
ALTER TABLE "finance_budget_members" ADD CONSTRAINT "finance_budget_members_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_budget_members" DROP CONSTRAINT IF EXISTS "finance_budget_members_user_id_users_id_fk";
ALTER TABLE "finance_budget_members" ADD CONSTRAINT "finance_budget_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_budgets" DROP CONSTRAINT IF EXISTS "finance_budgets_created_by_user_id_users_id_fk";
ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_categories" DROP CONSTRAINT IF EXISTS "finance_categories_budget_id_finance_budgets_id_fk";
ALTER TABLE "finance_categories" ADD CONSTRAINT "finance_categories_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_categories" DROP CONSTRAINT IF EXISTS "finance_categories_group_id_finance_groups_id_fk";
ALTER TABLE "finance_categories" ADD CONSTRAINT "finance_categories_group_id_finance_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."finance_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_groups" DROP CONSTRAINT IF EXISTS "finance_groups_budget_id_finance_budgets_id_fk";
ALTER TABLE "finance_groups" ADD CONSTRAINT "finance_groups_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_import_batches" DROP CONSTRAINT IF EXISTS "finance_import_batches_budget_id_finance_budgets_id_fk";
ALTER TABLE "finance_import_batches" ADD CONSTRAINT "finance_import_batches_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_import_batches" DROP CONSTRAINT IF EXISTS "finance_import_batches_user_id_users_id_fk";
ALTER TABLE "finance_import_batches" ADD CONSTRAINT "finance_import_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_monthly_plan_items" DROP CONSTRAINT IF EXISTS "finance_monthly_plan_items_plan_id_finance_monthly_plans_id_fk";
ALTER TABLE "finance_monthly_plan_items" ADD CONSTRAINT "finance_monthly_plan_items_plan_id_finance_monthly_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."finance_monthly_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_monthly_plan_items" DROP CONSTRAINT IF EXISTS "finance_monthly_plan_items_category_id_finance_categories_id_fk";
ALTER TABLE "finance_monthly_plan_items" ADD CONSTRAINT "finance_monthly_plan_items_category_id_finance_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."finance_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_monthly_plan_items" DROP CONSTRAINT IF EXISTS "finance_monthly_plan_items_merchant_id_finance_payees_id_fk";
ALTER TABLE "finance_monthly_plan_items" ADD CONSTRAINT "finance_monthly_plan_items_merchant_id_finance_payees_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."finance_payees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_monthly_plan_items" DROP CONSTRAINT IF EXISTS "finance_monthly_plan_items_linked_account_id_finance_accounts_id_fk";
ALTER TABLE "finance_monthly_plan_items" ADD CONSTRAINT "finance_monthly_plan_items_linked_account_id_finance_accounts_id_fk" FOREIGN KEY ("linked_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_monthly_plan_items" DROP CONSTRAINT IF EXISTS "finance_monthly_plan_items_assigned_transaction_id_finance_transactions_id_fk";
ALTER TABLE "finance_monthly_plan_items" ADD CONSTRAINT "finance_monthly_plan_items_assigned_transaction_id_finance_transactions_id_fk" FOREIGN KEY ("assigned_transaction_id") REFERENCES "public"."finance_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_monthly_plans" DROP CONSTRAINT IF EXISTS "finance_monthly_plans_budget_id_finance_budgets_id_fk";
ALTER TABLE "finance_monthly_plans" ADD CONSTRAINT "finance_monthly_plans_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_monthly_plans" DROP CONSTRAINT IF EXISTS "finance_monthly_plans_income_account_id_finance_accounts_id_fk";
ALTER TABLE "finance_monthly_plans" ADD CONSTRAINT "finance_monthly_plans_income_account_id_finance_accounts_id_fk" FOREIGN KEY ("income_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_net_worth_snapshots" DROP CONSTRAINT IF EXISTS "finance_net_worth_snapshots_budget_id_finance_budgets_id_fk";
ALTER TABLE "finance_net_worth_snapshots" ADD CONSTRAINT "finance_net_worth_snapshots_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_payees" DROP CONSTRAINT IF EXISTS "finance_payees_budget_id_finance_budgets_id_fk";
ALTER TABLE "finance_payees" ADD CONSTRAINT "finance_payees_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" DROP CONSTRAINT IF EXISTS "finance_transactions_budget_id_finance_budgets_id_fk";
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_budget_id_finance_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."finance_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" DROP CONSTRAINT IF EXISTS "finance_transactions_account_id_finance_accounts_id_fk";
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" DROP CONSTRAINT IF EXISTS "finance_transactions_to_account_id_finance_accounts_id_fk";
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_to_account_id_finance_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" DROP CONSTRAINT IF EXISTS "finance_transactions_category_id_finance_categories_id_fk";
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_category_id_finance_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."finance_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" DROP CONSTRAINT IF EXISTS "finance_transactions_payee_id_finance_payees_id_fk";
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_payee_id_finance_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."finance_payees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" DROP CONSTRAINT IF EXISTS "finance_transactions_added_by_user_id_users_id_fk";
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" DROP CONSTRAINT IF EXISTS "finance_transactions_import_batch_id_finance_import_batches_id_fk";
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_import_batch_id_finance_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."finance_import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meal_logs_user" ON "meal_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meal_logs_date" ON "meal_logs" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meal_logs_user_date" ON "meal_logs" USING btree ("user_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_body_measurements_user" ON "body_measurements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_body_measurements_date" ON "body_measurements" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_body_measurements_user_date" ON "body_measurements" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_body_measurements_user_type" ON "body_measurements" USING btree ("user_id","type_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logs_created_at" ON "api_request_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logs_path" ON "api_request_logs" USING btree ("path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logs_user" ON "api_request_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logs_status" ON "api_request_logs" USING btree ("status_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logs_service" ON "api_request_logs" USING btree ("service");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logs_client" ON "api_request_logs" USING btree ("client_id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logs_server" ON "api_request_logs" USING btree ("server");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_flight_data_number_date" ON "flight_data" USING btree ("flight_number","flight_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_flight_data_next_fetch_at" ON "flight_data" USING btree ("next_fetch_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_flight_data_finished" ON "flight_data" USING btree ("finished");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_bookings_trip_id" ON "trip_bookings" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_bookings_user_id" ON "trip_bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_bookings_start_at" ON "trip_bookings" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_checklist_items_trip_id" ON "trip_checklist_items" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_checklist_items_user_id" ON "trip_checklist_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_companions_trip_id" ON "trip_companions" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_companions_user_id" ON "trip_companions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_trip_days_trip_date" ON "trip_days" USING btree ("trip_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_days_trip_id" ON "trip_days" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_days_user_id" ON "trip_days" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_documents_trip_id" ON "trip_documents" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_documents_booking_id" ON "trip_documents" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_documents_user_id" ON "trip_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_places_trip_id" ON "trip_places" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_places_user_id" ON "trip_places" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_trip_shares_owner_trip_shared_with" ON "trip_shares" USING btree ("owner_user_id","trip_id","shared_with_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_shares_trip_id" ON "trip_shares" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trip_shares_shared_with_user_id" ON "trip_shares" USING btree ("shared_with_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trips_user_id" ON "trips" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trips_start_at" ON "trips" USING btree ("start_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notif_user_key_idx" ON "notification_preferences" USING btree ("user_id","subscription_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_accounts_budget" ON "finance_accounts" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_accounts_type" ON "finance_accounts" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_budget_members_budget" ON "finance_budget_members" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_budget_members_user" ON "finance_budget_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_categories_budget" ON "finance_categories" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_categories_group" ON "finance_categories" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_groups_budget" ON "finance_groups" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_import_batches_budget" ON "finance_import_batches" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_import_batches_user" ON "finance_import_batches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_plan_items_plan" ON "finance_monthly_plan_items" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_plan_items_linked_account" ON "finance_monthly_plan_items" USING btree ("linked_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_finance_monthly_plan_budget_month" ON "finance_monthly_plans" USING btree ("budget_id","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_monthly_plans_budget" ON "finance_monthly_plans" USING btree ("budget_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_finance_net_worth_budget_month" ON "finance_net_worth_snapshots" USING btree ("budget_id","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_net_worth_budget" ON "finance_net_worth_snapshots" USING btree ("budget_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_finance_payees_budget_norm" ON "finance_payees" USING btree ("budget_id","normalized_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_payees_budget" ON "finance_payees" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_budget" ON "finance_transactions" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_account" ON "finance_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_to_account" ON "finance_transactions" USING btree ("to_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_date" ON "finance_transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_category" ON "finance_transactions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_payee" ON "finance_transactions" USING btree ("payee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_added_by" ON "finance_transactions" USING btree ("added_by_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_import_batch" ON "finance_transactions" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_finance_txns_budget_date" ON "finance_transactions" USING btree ("budget_id","date");

-- Enable pg_trgm extension for trigram-based indexes (if not already enabled).
-- Enable required PostgreSQL extensions for this schema.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
--> statement-breakpoint
-- Trigram GIN index on api_request_logs.error to support fuzzy search on error messages.
CREATE INDEX IF NOT EXISTS "api_request_logs_error_trgm_idx" ON "api_request_logs" USING GIN ("error" gin_trgm_ops);
