-- Custom SQL migration file, put you code below! --
ALTER TABLE "apiary_tasks" ADD COLUMN "yard_id" integer;
ALTER TABLE "apiary_tasks" ADD CONSTRAINT "apiary_tasks_yard_id_apiary_yards_id_fk" FOREIGN KEY ("yard_id") REFERENCES "public"."apiary_yards"("id") ON DELETE set null ON UPDATE no action;