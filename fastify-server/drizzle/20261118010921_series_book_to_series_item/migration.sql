-- the books of the series (flat until now) become book items, same position and label
INSERT INTO "reading"."series_item" ("series_id", "position", "position_label", "book_id")
SELECT "series_id", "position", "position_label", "book_id" FROM "reading"."series_book";
