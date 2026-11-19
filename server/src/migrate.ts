// Applies the Drizzle migrations (server/drizzle) at container start, before the server (drizzle-kit is a dev dependency).
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { join } from "node:path";

import { envSchema } from "./config/env.schema.js";
import { createDrizzle } from "./database/drizzle.js";

const { DATABASE_URL } = envSchema.pick({ DATABASE_URL: true }).parse(process.env);
const db = createDrizzle(DATABASE_URL);

await migrate(db, { migrationsFolder: join(import.meta.dirname, "../drizzle") })
	.then(() => console.log("[migrate] done"))
	.finally(() => db.$client.end());
