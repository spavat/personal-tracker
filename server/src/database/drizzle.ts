import { drizzle } from "drizzle-orm/node-postgres";

import { relations } from "./relations.js";

export function createDrizzle(url: string) {
	return drizzle(url, { relations });
}
export type Drizzle = ReturnType<typeof createDrizzle>;
