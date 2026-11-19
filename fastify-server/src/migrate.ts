// Applies the Drizzle migrations (server/drizzle) at container start, before the server (drizzle-kit is a dev dependency).
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { join } from "node:path";

import { db } from "./db";

migrate(db, { migrationsFolder: join(__dirname, "../drizzle") })
	.then(() => console.log("[migrate] done"))
	.finally(() => db.$client.end());
