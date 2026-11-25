-- Show artists become person entities, the artist gallery and the role photos go. See .scratch/show-core/spec.md
-- (ticket 02). The schema statements are drizzle-kit's, the data steps in between are hand-written.

-- 1. One entity per artist: the person entity with the same name (case ignored) when there is one, else a new one
CREATE TEMP TABLE "artist_entity" ("artist_id" integer PRIMARY KEY, "entity_id" uuid NOT NULL, "created" boolean NOT NULL) ON COMMIT DROP;--> statement-breakpoint
INSERT INTO "artist_entity" ("artist_id", "entity_id", "created")
SELECT a."id", coalesce(e."id", gen_random_uuid()), e."id" IS NULL
FROM "show"."artist" a
LEFT JOIN LATERAL (
	SELECT "id" FROM "core"."entity" WHERE "kind" = 'person' AND lower("name") = lower(a."name") ORDER BY "id" LIMIT 1
) e ON true;--> statement-breakpoint
-- the portrait: the artist's main picture, unless it was taken for a spectacle (those 15 pictures are dropped)
CREATE TEMP TABLE "artist_portrait" ("artist_id" integer PRIMARY KEY, "key" text NOT NULL) ON COMMIT DROP;--> statement-breakpoint
INSERT INTO "artist_portrait" ("artist_id", "key")
SELECT a."id", m."key"
FROM "show"."artist" a
JOIN "show"."artist_media" am ON am."artist_id" = a."id" AND am."media_id" = a."picture_id"
JOIN "show"."media" m ON m."id" = am."media_id"
WHERE am."spectacle_id" IS NULL;--> statement-breakpoint
INSERT INTO "core"."node" ("id", "type", "label")
SELECT ae."entity_id", 'entity', a."name" FROM "artist_entity" ae JOIN "show"."artist" a ON a."id" = ae."artist_id" WHERE ae."created";--> statement-breakpoint
INSERT INTO "core"."entity" ("id", "kind", "name", "picture_key")
SELECT ae."entity_id", 'person', a."name", p."key"
FROM "artist_entity" ae
JOIN "show"."artist" a ON a."id" = ae."artist_id"
LEFT JOIN "artist_portrait" p ON p."artist_id" = a."id"
WHERE ae."created";--> statement-breakpoint
INSERT INTO "core"."entity_person" ("id") SELECT "entity_id" FROM "artist_entity" WHERE "created";--> statement-breakpoint
-- a merged artist gives its portrait to an entity without one
UPDATE "core"."entity" e SET "picture_key" = p."key"
FROM "artist_entity" ae JOIN "artist_portrait" p ON p."artist_id" = ae."artist_id"
WHERE e."id" = ae."entity_id" AND NOT ae."created" AND e."picture_key" IS NULL;--> statement-breakpoint

-- 2. The credits point to the entities
ALTER TABLE "show"."model_role" DROP CONSTRAINT "model_role_artist_id_artist_id_fkey";--> statement-breakpoint
ALTER TABLE "show"."model_role" DROP CONSTRAINT "model_role_picture_fkey";--> statement-breakpoint
ALTER TABLE "show"."role" DROP CONSTRAINT "role_artist_id_artist_id_fkey";--> statement-breakpoint
ALTER TABLE "show"."role" DROP CONSTRAINT "role_picture_fkey";--> statement-breakpoint
ALTER TABLE "show"."artist" DROP CONSTRAINT "artist_main_picture_fkey";--> statement-breakpoint
ALTER TABLE "show"."artist_media" DROP CONSTRAINT "artist_media_artist_id_artist_id_fkey";--> statement-breakpoint
ALTER TABLE "show"."model_role" ADD COLUMN "entity_id" uuid;--> statement-breakpoint
ALTER TABLE "show"."role" ADD COLUMN "entity_id" uuid;--> statement-breakpoint
UPDATE "show"."role" r SET "entity_id" = ae."entity_id" FROM "artist_entity" ae WHERE ae."artist_id" = r."artist_id";--> statement-breakpoint
UPDATE "show"."model_role" r SET "entity_id" = ae."entity_id" FROM "artist_entity" ae WHERE ae."artist_id" = r."artist_id";--> statement-breakpoint

-- Every credit found its entity: fails the migration otherwise
DO $$
DECLARE
	missing integer;
BEGIN
	SELECT
		(SELECT count(*) FROM "show"."role" WHERE ("artist_id" IS NULL) <> ("entity_id" IS NULL))
		+ (SELECT count(*) FROM "show"."model_role" WHERE ("artist_id" IS NULL) <> ("entity_id" IS NULL))
		+ (SELECT count(*) FROM "artist_entity" ae WHERE NOT EXISTS (SELECT 1 FROM "core"."entity" e WHERE e."id" = ae."entity_id"))
	INTO missing;
	IF missing > 0 THEN
		RAISE EXCEPTION 'show artists: % credits without their entity', missing;
	END IF;
END $$;--> statement-breakpoint

-- 3. The gallery goes: its media rows (the portraits kept are now only an entity's key; the S3 objects of the others
-- are deleted afterwards by the clean-show-media script)
DELETE FROM "show"."media" WHERE "id" IN (SELECT "media_id" FROM "show"."artist_media");--> statement-breakpoint
DROP TABLE "show"."artist";--> statement-breakpoint
DROP TABLE "show"."artist_media";--> statement-breakpoint
DROP INDEX "show"."model_role_artist_id_index";--> statement-breakpoint
ALTER TABLE "show"."model_role" DROP COLUMN "artist_id";--> statement-breakpoint
ALTER TABLE "show"."model_role" DROP COLUMN "picture_id";--> statement-breakpoint
ALTER TABLE "show"."role" DROP COLUMN "artist_id";--> statement-breakpoint
ALTER TABLE "show"."role" DROP COLUMN "picture_id";--> statement-breakpoint
CREATE INDEX "model_role_entity_id_index" ON "show"."model_role" ("entity_id");--> statement-breakpoint
CREATE INDEX "role_entity_id_index" ON "show"."role" ("entity_id");--> statement-breakpoint
ALTER TABLE "show"."model_role" ADD CONSTRAINT "model_role_entity_id_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "core"."entity"("id");--> statement-breakpoint
ALTER TABLE "show"."role" ADD CONSTRAINT "role_entity_id_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "core"."entity"("id");
