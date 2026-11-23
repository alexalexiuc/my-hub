CREATE TABLE "calorie_day_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"target" integer,
	"min" integer,
	"is_gym_day" boolean NOT NULL,
	"gym_day_bonus" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_calorie_day_targets_user_date" UNIQUE("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "calorie_day_targets" ADD CONSTRAINT "calorie_day_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;