CREATE SCHEMA "reading";
--> statement-breakpoint
CREATE TYPE "reading"."book_contributor_role" AS ENUM('author', 'illustrator', 'preface');--> statement-breakpoint
CREATE TYPE "reading"."edition_contributor_role" AS ENUM('translator');--> statement-breakpoint
CREATE TYPE "reading"."edition_type" AS ENUM('print', 'digital');--> statement-breakpoint
CREATE TYPE "reading"."status" AS ENUM('in-progress', 'complete', 'abandoned');--> statement-breakpoint
CREATE TABLE "reading"."book" (
	"id" uuid PRIMARY KEY,
	"title" text NOT NULL,
	"original_language" text,
	"country" text
);
--> statement-breakpoint
CREATE TABLE "reading"."book_contributor" (
	"book_id" uuid,
	"entity_id" uuid,
	"role" "reading"."book_contributor_role",
	"credited_as" text,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "book_contributor_pkey" PRIMARY KEY("book_id","entity_id","role")
);
--> statement-breakpoint
CREATE TABLE "reading"."edition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"book_id" uuid NOT NULL,
	"title" text,
	"publisher_id" uuid,
	"language" text,
	"pages" integer,
	"type" "reading"."edition_type",
	"isbn" text,
	"year" integer,
	"cover_key" text,
	"model_id" uuid
);
--> statement-breakpoint
CREATE TABLE "reading"."edition_contributor" (
	"edition_id" uuid,
	"entity_id" uuid,
	"role" "reading"."edition_contributor_role",
	"credited_as" text,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "edition_contributor_pkey" PRIMARY KEY("edition_id","entity_id","role")
);
--> statement-breakpoint
CREATE TABLE "reading"."entry" (
	"reading_id" uuid,
	"chapter_id" uuid,
	"date" date,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "entry_pkey" PRIMARY KEY("reading_id","chapter_id","date")
);
--> statement-breakpoint
CREATE TABLE "reading"."model" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"book_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tree" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading"."reading" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"edition_id" uuid NOT NULL,
	"status" "reading"."status" DEFAULT 'in-progress'::"reading"."status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading"."series" (
	"id" uuid PRIMARY KEY,
	"title" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading"."series_book" (
	"series_id" uuid,
	"book_id" uuid,
	"position" integer NOT NULL,
	"position_label" text,
	CONSTRAINT "series_book_pkey" PRIMARY KEY("series_id","book_id"),
	CONSTRAINT "series_book_series_id_position_key" UNIQUE("series_id","position")
);
--> statement-breakpoint
CREATE INDEX "book_contributor_entity_id_index" ON "reading"."book_contributor" ("entity_id");--> statement-breakpoint
CREATE INDEX "edition_book_id_index" ON "reading"."edition" ("book_id");--> statement-breakpoint
CREATE INDEX "edition_publisher_id_index" ON "reading"."edition" ("publisher_id");--> statement-breakpoint
CREATE INDEX "edition_model_id_index" ON "reading"."edition" ("model_id");--> statement-breakpoint
CREATE INDEX "edition_contributor_entity_id_index" ON "reading"."edition_contributor" ("entity_id");--> statement-breakpoint
CREATE INDEX "entry_date_index" ON "reading"."entry" ("date");--> statement-breakpoint
CREATE INDEX "model_book_id_index" ON "reading"."model" ("book_id");--> statement-breakpoint
CREATE INDEX "reading_edition_id_index" ON "reading"."reading" ("edition_id");--> statement-breakpoint
CREATE INDEX "series_book_book_id_index" ON "reading"."series_book" ("book_id");--> statement-breakpoint
ALTER TABLE "reading"."book" ADD CONSTRAINT "book_id_node_id_fkey" FOREIGN KEY ("id") REFERENCES "core"."node"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reading"."book_contributor" ADD CONSTRAINT "book_contributor_book_id_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "reading"."book"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reading"."book_contributor" ADD CONSTRAINT "book_contributor_entity_id_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "core"."entity"("id");--> statement-breakpoint
ALTER TABLE "reading"."edition" ADD CONSTRAINT "edition_book_id_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "reading"."book"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reading"."edition" ADD CONSTRAINT "edition_publisher_id_entity_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "core"."entity"("id");--> statement-breakpoint
ALTER TABLE "reading"."edition" ADD CONSTRAINT "edition_model_id_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "reading"."model"("id");--> statement-breakpoint
ALTER TABLE "reading"."edition_contributor" ADD CONSTRAINT "edition_contributor_edition_id_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "reading"."edition"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reading"."edition_contributor" ADD CONSTRAINT "edition_contributor_entity_id_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "core"."entity"("id");--> statement-breakpoint
ALTER TABLE "reading"."entry" ADD CONSTRAINT "entry_reading_id_reading_id_fkey" FOREIGN KEY ("reading_id") REFERENCES "reading"."reading"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reading"."model" ADD CONSTRAINT "model_book_id_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "reading"."book"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reading"."reading" ADD CONSTRAINT "reading_edition_id_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "reading"."edition"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reading"."series" ADD CONSTRAINT "series_id_node_id_fkey" FOREIGN KEY ("id") REFERENCES "core"."node"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reading"."series_book" ADD CONSTRAINT "series_book_series_id_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "reading"."series"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reading"."series_book" ADD CONSTRAINT "series_book_book_id_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "reading"."book"("id") ON DELETE CASCADE;