CREATE SCHEMA "broadcast";
--> statement-breakpoint
CREATE TYPE "broadcast"."episode_contributor_role" AS ENUM('host', 'guest', 'interviewee');--> statement-breakpoint
CREATE TYPE "broadcast"."episode_status" AS ENUM('planned', 'skipped');--> statement-breakpoint
CREATE TYPE "broadcast"."program_contributor_role" AS ENUM('host', 'producer', 'network');--> statement-breakpoint
CREATE TYPE "broadcast"."tracking" AS ENUM('catalog', 'feed');--> statement-breakpoint
ALTER TYPE "core"."node_type" ADD VALUE 'program';--> statement-breakpoint
ALTER TYPE "core"."node_type" ADD VALUE 'episode';--> statement-breakpoint
CREATE TABLE "broadcast"."episode" (
	"id" uuid PRIMARY KEY,
	"program_id" uuid NOT NULL,
	"season_id" uuid,
	"format_id" uuid,
	"position" integer,
	"number_label" text,
	"name" text NOT NULL,
	"short_name" text,
	"type" text,
	"release_date" date,
	"duration" integer,
	"link" text,
	"external_id" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"ignored_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "broadcast"."episode_status",
	CONSTRAINT "episode_program_id_external_id_key" UNIQUE("program_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "broadcast"."episode_contributor" (
	"episode_id" uuid,
	"entity_id" uuid,
	"role" "broadcast"."episode_contributor_role",
	"credited_as" text,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "episode_contributor_pkey" PRIMARY KEY("episode_id","entity_id","role")
);
--> statement-breakpoint
CREATE TABLE "broadcast"."format" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"program_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL,
	"match" text,
	CONSTRAINT "format_program_id_label_key" UNIQUE("program_id","label")
);
--> statement-breakpoint
CREATE TABLE "broadcast"."program" (
	"id" uuid PRIMARY KEY,
	"name" text NOT NULL,
	"short_name" text,
	"description" text,
	"country" text,
	"type" text,
	"tracking" "broadcast"."tracking" DEFAULT 'feed'::"broadcast"."tracking" NOT NULL,
	"rss" text,
	"youtube_channel_id" text,
	"youtube_playlist_id" text,
	"links" text[] DEFAULT '{}'::text[] NOT NULL,
	"profile_key" text,
	"banner_key" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"private" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcast"."program_contributor" (
	"program_id" uuid,
	"entity_id" uuid,
	"role" "broadcast"."program_contributor_role",
	"credited_as" text,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "program_contributor_pkey" PRIMARY KEY("program_id","entity_id","role")
);
--> statement-breakpoint
CREATE TABLE "broadcast"."season" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"program_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "season_program_id_position_key" UNIQUE("program_id","position")
);
--> statement-breakpoint
CREATE TABLE "broadcast"."view" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"episode_id" uuid NOT NULL,
	"date" date NOT NULL,
	"duration" integer,
	"context_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "episode_program_id_release_date_index" ON "broadcast"."episode" ("program_id","release_date");--> statement-breakpoint
CREATE INDEX "episode_season_id_index" ON "broadcast"."episode" ("season_id");--> statement-breakpoint
CREATE INDEX "episode_format_id_index" ON "broadcast"."episode" ("format_id");--> statement-breakpoint
CREATE INDEX "episode_contributor_entity_id_index" ON "broadcast"."episode_contributor" ("entity_id");--> statement-breakpoint
CREATE INDEX "program_contributor_entity_id_index" ON "broadcast"."program_contributor" ("entity_id");--> statement-breakpoint
CREATE INDEX "view_episode_id_index" ON "broadcast"."view" ("episode_id");--> statement-breakpoint
CREATE INDEX "view_date_index" ON "broadcast"."view" ("date");--> statement-breakpoint
ALTER TABLE "broadcast"."episode" ADD CONSTRAINT "episode_id_node_id_fkey" FOREIGN KEY ("id") REFERENCES "core"."node"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "broadcast"."episode" ADD CONSTRAINT "episode_program_id_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "broadcast"."program"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "broadcast"."episode" ADD CONSTRAINT "episode_season_id_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "broadcast"."season"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "broadcast"."episode" ADD CONSTRAINT "episode_format_id_format_id_fkey" FOREIGN KEY ("format_id") REFERENCES "broadcast"."format"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "broadcast"."episode_contributor" ADD CONSTRAINT "episode_contributor_episode_id_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "broadcast"."episode"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "broadcast"."episode_contributor" ADD CONSTRAINT "episode_contributor_entity_id_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "core"."entity"("id");--> statement-breakpoint
ALTER TABLE "broadcast"."format" ADD CONSTRAINT "format_program_id_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "broadcast"."program"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "broadcast"."program" ADD CONSTRAINT "program_id_node_id_fkey" FOREIGN KEY ("id") REFERENCES "core"."node"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "broadcast"."program_contributor" ADD CONSTRAINT "program_contributor_program_id_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "broadcast"."program"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "broadcast"."program_contributor" ADD CONSTRAINT "program_contributor_entity_id_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "core"."entity"("id");--> statement-breakpoint
ALTER TABLE "broadcast"."season" ADD CONSTRAINT "season_program_id_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "broadcast"."program"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "broadcast"."view" ADD CONSTRAINT "view_episode_id_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "broadcast"."episode"("id") ON DELETE CASCADE;