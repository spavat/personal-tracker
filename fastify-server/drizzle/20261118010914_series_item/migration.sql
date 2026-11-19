CREATE TABLE "reading"."series_item" (
	"series_id" uuid,
	"position" integer,
	"position_label" text,
	"book_id" uuid,
	"child_series_id" uuid,
	CONSTRAINT "series_item_pkey" PRIMARY KEY("series_id","position"),
	CONSTRAINT "series_item_series_id_book_id_key" UNIQUE("series_id","book_id"),
	CONSTRAINT "series_item_series_id_child_series_id_key" UNIQUE("series_id","child_series_id"),
	CONSTRAINT "series_item_one_kind_check" CHECK (num_nonnulls("book_id", "child_series_id") = 1)
);
--> statement-breakpoint
CREATE INDEX "series_item_book_id_index" ON "reading"."series_item" ("book_id");--> statement-breakpoint
CREATE INDEX "series_item_child_series_id_index" ON "reading"."series_item" ("child_series_id");--> statement-breakpoint
ALTER TABLE "reading"."series_item" ADD CONSTRAINT "series_item_series_id_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "reading"."series"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reading"."series_item" ADD CONSTRAINT "series_item_book_id_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "reading"."book"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reading"."series_item" ADD CONSTRAINT "series_item_child_series_id_series_id_fkey" FOREIGN KEY ("child_series_id") REFERENCES "reading"."series"("id") ON DELETE CASCADE;