CREATE TYPE "core"."external_source" AS ENUM('openLibrary');--> statement-breakpoint
-- The migrator runs the pending migrations in one transaction, where a value added by ALTER TYPE … ADD VALUE
-- can't be used yet (the edition nodes below): the type is recreated with it instead
ALTER TYPE "core"."node_type" RENAME TO "node_type_old";--> statement-breakpoint
CREATE TYPE "core"."node_type" AS ENUM('entity', 'book', 'book_series', 'book_edition');--> statement-breakpoint
ALTER TABLE "core"."node" ALTER COLUMN "type" TYPE "core"."node_type" USING "type"::text::"core"."node_type";--> statement-breakpoint
DROP TYPE "core"."node_type_old";--> statement-breakpoint
CREATE TABLE "core"."external_id" (
	"node_id" uuid,
	"source" "core"."external_source",
	"external_id" text NOT NULL,
	CONSTRAINT "external_id_pkey" PRIMARY KEY("node_id","source"),
	CONSTRAINT "external_id_source_external_id_key" UNIQUE("source","external_id")
);
--> statement-breakpoint
ALTER TABLE "reading"."edition" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
-- Each existing edition gets its node, with the same id, named after its title or its book's
INSERT INTO "core"."node" ("id", "type", "label")
SELECT e."id", 'book_edition', coalesce(e."title", b."title")
FROM "reading"."edition" e JOIN "reading"."book" b ON b."id" = e."book_id";--> statement-breakpoint
ALTER TABLE "core"."external_id" ADD CONSTRAINT "external_id_node_id_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "core"."node"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reading"."edition" ADD CONSTRAINT "edition_id_node_id_fkey" FOREIGN KEY ("id") REFERENCES "core"."node"("id") ON DELETE CASCADE;
