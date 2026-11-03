CREATE TYPE "show"."spectacle_media_kind" AS ENUM('poster', 'photo', 'programme', 'recording');--> statement-breakpoint
CREATE TABLE "show"."artist_media" (
	"artist_id" integer,
	"media_id" uuid,
	"spectacle_id" integer,
	CONSTRAINT "artist_media_pkey" PRIMARY KEY("artist_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "show"."media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"key" varchar(200) NOT NULL,
	"label" varchar(100) DEFAULT '' NOT NULL,
	"content_type" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "show"."spectacle_media" (
	"spectacle_id" integer,
	"media_id" uuid,
	"kind" "show"."spectacle_media_kind" DEFAULT 'poster'::"show"."spectacle_media_kind" NOT NULL,
	CONSTRAINT "spectacle_media_pkey" PRIMARY KEY("spectacle_id","media_id")
);
--> statement-breakpoint
ALTER TABLE "show"."artist" ADD COLUMN "picture_id" uuid;--> statement-breakpoint
ALTER TABLE "show"."model_role" ADD COLUMN "picture_id" uuid;--> statement-breakpoint
ALTER TABLE "show"."performance" ADD COLUMN "poster_id" uuid;--> statement-breakpoint
ALTER TABLE "show"."role" ADD COLUMN "picture_id" uuid;--> statement-breakpoint
CREATE INDEX "artist_media_media_id_index" ON "show"."artist_media" ("media_id");--> statement-breakpoint
CREATE INDEX "spectacle_media_media_id_index" ON "show"."spectacle_media" ("media_id");--> statement-breakpoint
ALTER TABLE "show"."artist" ADD CONSTRAINT "artist_main_picture_fkey" FOREIGN KEY ("id","picture_id") REFERENCES "show"."artist_media"("artist_id","media_id");--> statement-breakpoint
ALTER TABLE "show"."artist_media" ADD CONSTRAINT "artist_media_artist_id_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "show"."artist"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "show"."artist_media" ADD CONSTRAINT "artist_media_media_id_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "show"."media"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "show"."artist_media" ADD CONSTRAINT "artist_media_spectacle_id_spectacle_id_fkey" FOREIGN KEY ("spectacle_id") REFERENCES "show"."spectacle"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "show"."model_role" ADD CONSTRAINT "model_role_picture_fkey" FOREIGN KEY ("artist_id","picture_id") REFERENCES "show"."artist_media"("artist_id","media_id");--> statement-breakpoint
ALTER TABLE "show"."performance" ADD CONSTRAINT "performance_poster_fkey" FOREIGN KEY ("spectacle_id","poster_id") REFERENCES "show"."spectacle_media"("spectacle_id","media_id");--> statement-breakpoint
ALTER TABLE "show"."role" ADD CONSTRAINT "role_picture_fkey" FOREIGN KEY ("artist_id","picture_id") REFERENCES "show"."artist_media"("artist_id","media_id");--> statement-breakpoint
ALTER TABLE "show"."spectacle_media" ADD CONSTRAINT "spectacle_media_spectacle_id_spectacle_id_fkey" FOREIGN KEY ("spectacle_id") REFERENCES "show"."spectacle"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "show"."spectacle_media" ADD CONSTRAINT "spectacle_media_media_id_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "show"."media"("id") ON DELETE CASCADE;