ALTER TABLE "show"."media" ADD COLUMN "order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "show"."media" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;