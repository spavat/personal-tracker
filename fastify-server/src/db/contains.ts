import { sql, type AnyColumn } from "drizzle-orm";

// Case- and accent-insensitive "contains" ("opera" matches "Opéra"), as the former MySQL *_ci collations did
export function contains(column: AnyColumn, search: string) {
	return sql`unaccent(${column}) ilike unaccent(${`%${search}%`})`;
}
