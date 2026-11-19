CREATE SCHEMA "core";
--> statement-breakpoint
CREATE TYPE "core"."entity_kind" AS ENUM('person', 'group', 'organization');--> statement-breakpoint
CREATE TYPE "core"."node_type" AS ENUM('entity', 'book', 'book_series');--> statement-breakpoint
CREATE TABLE "core"."entity" (
	"id" uuid PRIMARY KEY,
	"kind" "core"."entity_kind" NOT NULL,
	"name" text NOT NULL,
	"sort_name" text,
	"picture_key" text,
	CONSTRAINT "entity_id_kind_key" UNIQUE("id","kind")
);
--> statement-breakpoint
CREATE TABLE "core"."entity_group" (
	"id" uuid PRIMARY KEY,
	"kind" "core"."entity_kind" DEFAULT 'group'::"core"."entity_kind" NOT NULL,
	"formed_on" date,
	"dissolved_on" date,
	CONSTRAINT "entity_group_kind_check" CHECK ("kind" = 'group')
);
--> statement-breakpoint
CREATE TABLE "core"."entity_organization" (
	"id" uuid PRIMARY KEY,
	"kind" "core"."entity_kind" DEFAULT 'organization'::"core"."entity_kind" NOT NULL,
	"founded_on" date,
	"dissolved_on" date,
	CONSTRAINT "entity_organization_kind_check" CHECK ("kind" = 'organization')
);
--> statement-breakpoint
CREATE TABLE "core"."entity_person" (
	"id" uuid PRIMARY KEY,
	"kind" "core"."entity_kind" DEFAULT 'person'::"core"."entity_kind" NOT NULL,
	"birth_date" date,
	"death_date" date,
	CONSTRAINT "entity_person_kind_check" CHECK ("kind" = 'person')
);
--> statement-breakpoint
CREATE TABLE "core"."node" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"type" "core"."node_type" NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "entity_kind_index" ON "core"."entity" ("kind");--> statement-breakpoint
ALTER TABLE "core"."entity" ADD CONSTRAINT "entity_id_node_id_fkey" FOREIGN KEY ("id") REFERENCES "core"."node"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core"."entity_group" ADD CONSTRAINT "entity_group_entity_fkey" FOREIGN KEY ("id","kind") REFERENCES "core"."entity"("id","kind") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core"."entity_organization" ADD CONSTRAINT "entity_organization_entity_fkey" FOREIGN KEY ("id","kind") REFERENCES "core"."entity"("id","kind") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core"."entity_person" ADD CONSTRAINT "entity_person_entity_fkey" FOREIGN KEY ("id","kind") REFERENCES "core"."entity"("id","kind") ON DELETE CASCADE;