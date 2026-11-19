ALTER TABLE "show"."spectacle" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "show"."spectacle" ADD COLUMN "description_source" text;--> statement-breakpoint
ALTER TABLE "show"."spectacle" ADD COLUMN "links" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "show"."spectacle" ADD COLUMN "tracklist" text;