CREATE TABLE "favourite_meals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"description" text NOT NULL,
	"meal_type" text NOT NULL,
	"kcal" integer,
	"protein" real,
	"carbs" real,
	"fat" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_favourite_meals_user_description" UNIQUE("user_id","description")
);
--> statement-breakpoint
ALTER TABLE "favourite_meals" ADD CONSTRAINT "favourite_meals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;