-- Show on uuid ids: every show table with an integer id moves to a uuid, and works, spectacles and places become
-- nodes (same uuid as their core.node row). See .scratch/show-core/spec.md (ticket 01).
-- Hand-written: drizzle-kit's `SET DATA TYPE uuid USING id::uuid` can't convert integers. The generated snapshot
-- is kept. Each table gets a new uuid column, the referencing columns are remapped through the old integer ids,
-- then the integer columns are dropped and the new ones take their names.

-- The migrator runs the pending migrations in one transaction, where a value added by ALTER TYPE … ADD VALUE
-- can't be used yet (the nodes below): the type is recreated with it instead
ALTER TYPE "core"."node_type" RENAME TO "node_type_old";--> statement-breakpoint
CREATE TYPE "core"."node_type" AS ENUM('entity', 'book', 'book_series', 'book_edition', 'program', 'episode', 'show_work', 'show_spectacle', 'show_place');--> statement-breakpoint
ALTER TABLE "core"."node" ALTER COLUMN "type" TYPE "core"."node_type" USING "type"::text::"core"."node_type";--> statement-breakpoint
DROP TYPE "core"."node_type_old";--> statement-breakpoint

-- 1. Constraints on the columns that change
ALTER TABLE "show"."artist_media" DROP CONSTRAINT "artist_media_spectacle_id_spectacle_id_fkey";--> statement-breakpoint
ALTER TABLE "show"."model" DROP CONSTRAINT "model_spectacle_id_spectacle_id_fkey";--> statement-breakpoint
ALTER TABLE "show"."model_role" DROP CONSTRAINT "model_role_model_id_model_id_fkey";--> statement-breakpoint
ALTER TABLE "show"."performance" DROP CONSTRAINT "performance_place_id_place_id_fkey";--> statement-breakpoint
ALTER TABLE "show"."performance" DROP CONSTRAINT "performance_spectacle_id_spectacle_id_fkey";--> statement-breakpoint
ALTER TABLE "show"."performance" DROP CONSTRAINT "performance_poster_fkey";--> statement-breakpoint
ALTER TABLE "show"."place_former_name" DROP CONSTRAINT "place_former_name_place_id_place_id_fkey";--> statement-breakpoint
ALTER TABLE "show"."role" DROP CONSTRAINT "role_performance_id_performance_id_fkey";--> statement-breakpoint
ALTER TABLE "show"."spectacle" DROP CONSTRAINT "spectacle_work_id_work_id_fkey";--> statement-breakpoint
ALTER TABLE "show"."spectacle_media" DROP CONSTRAINT "spectacle_media_spectacle_id_spectacle_id_fkey";--> statement-breakpoint
ALTER TABLE "show"."spectacle_media" DROP CONSTRAINT "spectacle_media_pkey";--> statement-breakpoint
ALTER TABLE "show"."work" DROP CONSTRAINT "work_pkey";--> statement-breakpoint
ALTER TABLE "show"."spectacle" DROP CONSTRAINT "spectacle_pkey";--> statement-breakpoint
ALTER TABLE "show"."place" DROP CONSTRAINT "place_pkey";--> statement-breakpoint
ALTER TABLE "show"."place_former_name" DROP CONSTRAINT "place_former_name_pkey";--> statement-breakpoint
ALTER TABLE "show"."performance" DROP CONSTRAINT "performance_pkey";--> statement-breakpoint
ALTER TABLE "show"."model" DROP CONSTRAINT "model_pkey";--> statement-breakpoint
ALTER TABLE "show"."model_role" DROP CONSTRAINT "model_role_pkey";--> statement-breakpoint
ALTER TABLE "show"."role" DROP CONSTRAINT "role_pkey";--> statement-breakpoint

-- 2. A uuid for every row
ALTER TABLE "show"."work" ADD COLUMN "new_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "show"."spectacle" ADD COLUMN "new_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "show"."place" ADD COLUMN "new_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "show"."place_former_name" ADD COLUMN "new_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "show"."performance" ADD COLUMN "new_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "show"."model" ADD COLUMN "new_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "show"."model_role" ADD COLUMN "new_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "show"."role" ADD COLUMN "new_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint

-- 3. The references, remapped through the integer ids
ALTER TABLE "show"."spectacle" ADD COLUMN "new_work_id" uuid;--> statement-breakpoint
UPDATE "show"."spectacle" s SET "new_work_id" = w."new_id" FROM "show"."work" w WHERE w."id" = s."work_id";--> statement-breakpoint
ALTER TABLE "show"."performance" ADD COLUMN "new_spectacle_id" uuid, ADD COLUMN "new_place_id" uuid;--> statement-breakpoint
UPDATE "show"."performance" p SET "new_spectacle_id" = s."new_id" FROM "show"."spectacle" s WHERE s."id" = p."spectacle_id";--> statement-breakpoint
UPDATE "show"."performance" p SET "new_place_id" = pl."new_id" FROM "show"."place" pl WHERE pl."id" = p."place_id";--> statement-breakpoint
ALTER TABLE "show"."model" ADD COLUMN "new_spectacle_id" uuid;--> statement-breakpoint
UPDATE "show"."model" m SET "new_spectacle_id" = s."new_id" FROM "show"."spectacle" s WHERE s."id" = m."spectacle_id";--> statement-breakpoint
ALTER TABLE "show"."model_role" ADD COLUMN "new_model_id" uuid;--> statement-breakpoint
UPDATE "show"."model_role" r SET "new_model_id" = m."new_id" FROM "show"."model" m WHERE m."id" = r."model_id";--> statement-breakpoint
ALTER TABLE "show"."role" ADD COLUMN "new_performance_id" uuid;--> statement-breakpoint
UPDATE "show"."role" r SET "new_performance_id" = p."new_id" FROM "show"."performance" p WHERE p."id" = r."performance_id";--> statement-breakpoint
ALTER TABLE "show"."spectacle_media" ADD COLUMN "new_spectacle_id" uuid;--> statement-breakpoint
UPDATE "show"."spectacle_media" sm SET "new_spectacle_id" = s."new_id" FROM "show"."spectacle" s WHERE s."id" = sm."spectacle_id";--> statement-breakpoint
ALTER TABLE "show"."artist_media" ADD COLUMN "new_spectacle_id" uuid;--> statement-breakpoint
UPDATE "show"."artist_media" am SET "new_spectacle_id" = s."new_id" FROM "show"."spectacle" s WHERE s."id" = am."spectacle_id";--> statement-breakpoint
ALTER TABLE "show"."place_former_name" ADD COLUMN "new_place_id" uuid;--> statement-breakpoint
UPDATE "show"."place_former_name" f SET "new_place_id" = pl."new_id" FROM "show"."place" pl WHERE pl."id" = f."place_id";--> statement-breakpoint

-- Every reference found its row (a dangling integer would silently become NULL): fails the migration otherwise
DO $$
DECLARE
	missing integer;
BEGIN
	SELECT
		(SELECT count(*) FROM "show"."spectacle" WHERE ("work_id" IS NULL) <> ("new_work_id" IS NULL))
		+ (SELECT count(*) FROM "show"."performance" WHERE ("spectacle_id" IS NULL) <> ("new_spectacle_id" IS NULL))
		+ (SELECT count(*) FROM "show"."performance" WHERE ("place_id" IS NULL) <> ("new_place_id" IS NULL))
		+ (SELECT count(*) FROM "show"."model" WHERE ("spectacle_id" IS NULL) <> ("new_spectacle_id" IS NULL))
		+ (SELECT count(*) FROM "show"."model_role" WHERE ("model_id" IS NULL) <> ("new_model_id" IS NULL))
		+ (SELECT count(*) FROM "show"."role" WHERE ("performance_id" IS NULL) <> ("new_performance_id" IS NULL))
		+ (SELECT count(*) FROM "show"."spectacle_media" WHERE ("spectacle_id" IS NULL) <> ("new_spectacle_id" IS NULL))
		+ (SELECT count(*) FROM "show"."artist_media" WHERE ("spectacle_id" IS NULL) <> ("new_spectacle_id" IS NULL))
		+ (SELECT count(*) FROM "show"."place_former_name" WHERE ("place_id" IS NULL) <> ("new_place_id" IS NULL))
	INTO missing;
	IF missing > 0 THEN
		RAISE EXCEPTION 'show uuids: % references without their row', missing;
	END IF;
END $$;--> statement-breakpoint

-- 4. The integer columns go, the uuid ones take their names
ALTER TABLE "show"."spectacle" DROP COLUMN "work_id";--> statement-breakpoint
ALTER TABLE "show"."spectacle" RENAME COLUMN "new_work_id" TO "work_id";--> statement-breakpoint
ALTER TABLE "show"."performance" DROP COLUMN "spectacle_id";--> statement-breakpoint
ALTER TABLE "show"."performance" RENAME COLUMN "new_spectacle_id" TO "spectacle_id";--> statement-breakpoint
ALTER TABLE "show"."performance" DROP COLUMN "place_id";--> statement-breakpoint
ALTER TABLE "show"."performance" RENAME COLUMN "new_place_id" TO "place_id";--> statement-breakpoint
ALTER TABLE "show"."model" DROP COLUMN "spectacle_id";--> statement-breakpoint
ALTER TABLE "show"."model" RENAME COLUMN "new_spectacle_id" TO "spectacle_id";--> statement-breakpoint
ALTER TABLE "show"."model_role" DROP COLUMN "model_id";--> statement-breakpoint
ALTER TABLE "show"."model_role" RENAME COLUMN "new_model_id" TO "model_id";--> statement-breakpoint
ALTER TABLE "show"."role" DROP COLUMN "performance_id";--> statement-breakpoint
ALTER TABLE "show"."role" RENAME COLUMN "new_performance_id" TO "performance_id";--> statement-breakpoint
ALTER TABLE "show"."spectacle_media" DROP COLUMN "spectacle_id";--> statement-breakpoint
ALTER TABLE "show"."spectacle_media" RENAME COLUMN "new_spectacle_id" TO "spectacle_id";--> statement-breakpoint
ALTER TABLE "show"."artist_media" DROP COLUMN "spectacle_id";--> statement-breakpoint
ALTER TABLE "show"."artist_media" RENAME COLUMN "new_spectacle_id" TO "spectacle_id";--> statement-breakpoint
ALTER TABLE "show"."place_former_name" DROP COLUMN "place_id";--> statement-breakpoint
ALTER TABLE "show"."place_former_name" RENAME COLUMN "new_place_id" TO "place_id";--> statement-breakpoint
ALTER TABLE "show"."work" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "show"."work" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "show"."spectacle" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "show"."spectacle" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "show"."place" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "show"."place" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "show"."place_former_name" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "show"."place_former_name" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "show"."performance" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "show"."performance" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "show"."model" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "show"."model" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "show"."model_role" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "show"."model_role" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "show"."role" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "show"."role" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint

-- 5. Nodes: a node id is chosen by the row's creation (createNode), no default
ALTER TABLE "show"."work" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "show"."spectacle" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "show"."place" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
INSERT INTO "core"."node" ("id", "type", "label") SELECT "id", 'show_work', "name" FROM "show"."work";--> statement-breakpoint
INSERT INTO "core"."node" ("id", "type", "label") SELECT "id", 'show_spectacle', "name" FROM "show"."spectacle";--> statement-breakpoint
INSERT INTO "core"."node" ("id", "type", "label") SELECT "id", 'show_place', "name" FROM "show"."place";--> statement-breakpoint

-- 6. Constraints and indexes back, with their former names
ALTER TABLE "show"."work" ADD CONSTRAINT "work_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "show"."spectacle" ADD CONSTRAINT "spectacle_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "show"."place" ADD CONSTRAINT "place_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "show"."place_former_name" ADD CONSTRAINT "place_former_name_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "show"."performance" ADD CONSTRAINT "performance_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "show"."model" ADD CONSTRAINT "model_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "show"."model_role" ADD CONSTRAINT "model_role_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "show"."role" ADD CONSTRAINT "role_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "show"."spectacle" ALTER COLUMN "work_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "show"."performance" ALTER COLUMN "spectacle_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "show"."model" ALTER COLUMN "spectacle_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "show"."spectacle_media" ALTER COLUMN "spectacle_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "show"."place_former_name" ALTER COLUMN "place_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "show"."spectacle_media" ADD CONSTRAINT "spectacle_media_pkey" PRIMARY KEY ("spectacle_id", "media_id");--> statement-breakpoint
ALTER TABLE "show"."work" ADD CONSTRAINT "work_id_node_id_fkey" FOREIGN KEY ("id") REFERENCES "core"."node"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "show"."spectacle" ADD CONSTRAINT "spectacle_id_node_id_fkey" FOREIGN KEY ("id") REFERENCES "core"."node"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "show"."place" ADD CONSTRAINT "place_id_node_id_fkey" FOREIGN KEY ("id") REFERENCES "core"."node"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "show"."spectacle" ADD CONSTRAINT "spectacle_work_id_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "show"."work"("id");--> statement-breakpoint
ALTER TABLE "show"."performance" ADD CONSTRAINT "performance_place_id_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "show"."place"("id");--> statement-breakpoint
ALTER TABLE "show"."performance" ADD CONSTRAINT "performance_spectacle_id_spectacle_id_fkey" FOREIGN KEY ("spectacle_id") REFERENCES "show"."spectacle"("id");--> statement-breakpoint
ALTER TABLE "show"."performance" ADD CONSTRAINT "performance_poster_fkey" FOREIGN KEY ("spectacle_id","poster_id") REFERENCES "show"."spectacle_media"("spectacle_id","media_id");--> statement-breakpoint
ALTER TABLE "show"."model" ADD CONSTRAINT "model_spectacle_id_spectacle_id_fkey" FOREIGN KEY ("spectacle_id") REFERENCES "show"."spectacle"("id");--> statement-breakpoint
ALTER TABLE "show"."model_role" ADD CONSTRAINT "model_role_model_id_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "show"."model"("id");--> statement-breakpoint
ALTER TABLE "show"."role" ADD CONSTRAINT "role_performance_id_performance_id_fkey" FOREIGN KEY ("performance_id") REFERENCES "show"."performance"("id");--> statement-breakpoint
ALTER TABLE "show"."spectacle_media" ADD CONSTRAINT "spectacle_media_spectacle_id_spectacle_id_fkey" FOREIGN KEY ("spectacle_id") REFERENCES "show"."spectacle"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "show"."artist_media" ADD CONSTRAINT "artist_media_spectacle_id_spectacle_id_fkey" FOREIGN KEY ("spectacle_id") REFERENCES "show"."spectacle"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "show"."place_former_name" ADD CONSTRAINT "place_former_name_place_id_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "show"."place"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX "model_role_model_id_index" ON "show"."model_role" ("model_id");--> statement-breakpoint
CREATE INDEX "performance_place_id_index" ON "show"."performance" ("place_id");--> statement-breakpoint
CREATE INDEX "performance_spectacle_id_index" ON "show"."performance" ("spectacle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "place_former_name_place_id_until_date_index" ON "show"."place_former_name" ("place_id","until_date");--> statement-breakpoint
CREATE INDEX "spectacle_work_id_index" ON "show"."spectacle" ("work_id");
