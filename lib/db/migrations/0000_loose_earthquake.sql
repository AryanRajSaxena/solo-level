CREATE TABLE "daily_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"quest_id" text NOT NULL,
	"completed_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'AWAKENED HUNTER' NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"xp_to_next" integer DEFAULT 1000 NOT NULL,
	"rank" text DEFAULT 'E' NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"stat_str" integer DEFAULT 1 NOT NULL,
	"stat_int" integer DEFAULT 1 NOT NULL,
	"stat_stamina" integer DEFAULT 1 NOT NULL,
	"stat_discipline" integer DEFAULT 1 NOT NULL,
	"title" text DEFAULT 'Unranked' NOT NULL,
	"lockdown_until" timestamp with time zone,
	"last_completed_date" text,
	"journey_start_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'DISCIPLINE' NOT NULL,
	"target" integer DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'set' NOT NULL,
	"xp" integer DEFAULT 25 NOT NULL,
	"stat" text DEFAULT 'DISCIPLINE' NOT NULL,
	"weekdays" integer[] NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"ramp_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'The Architect''s Trial' NOT NULL,
	"detail" text DEFAULT 'Complete every active quest twice this week' NOT NULL,
	"target" integer DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'completions' NOT NULL,
	"xp" integer DEFAULT 300 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"week_key" text NOT NULL,
	"required_quest_ids" text[] DEFAULT '{}' NOT NULL,
	"evaluated_at" timestamp with time zone,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rest_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"day" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_completions" ADD CONSTRAINT "daily_completions_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raids" ADD CONSTRAINT "raids_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rest_days" ADD CONSTRAINT "rest_days_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_completion" ON "daily_completions" USING btree ("user_id","quest_id","completed_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rest_day" ON "rest_days" USING btree ("user_id","day");