// Imports the GPX activities of a Strava export, skipping the ones already imported (it can be run again on a newer
// export). The folder is the unzipped export: activities.csv and activities/*.gpx (the .gpx.gz and .fit are left out).
// Usage, from server/ after a build: npm run import-strava -- <export folder>
// (in production, the folder must be visible to the container: docker compose cp it, then docker compose exec)
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { envSchema } from "../config/env.schema.js";
import { SportModule } from "../sport/sport.module.js";
import { SportService } from "../sport/sport.service.js";

const [exportDir] = process.argv.slice(2);
if (!exportDir || !existsSync(join(exportDir, "activities.csv"))) {
	console.error("Usage: npm run import-strava -- <export folder> (the folder holding activities.csv)");
	process.exit(1);
}

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }), SportModule] })
class ImportStravaModule {}

const app = await NestFactory.createApplicationContext(ImportStravaModule);
try {
	const { total, skipped, imported, errors } = await app.get(SportService).importStrava(exportDir);
	console.log(`${total} GPX activities: ${skipped} already imported, ${imported} imported, ${errors.length} failed`);
	for (const error of errors) console.log(`  ${error}`);
	process.exitCode = errors.length ? 1 : 0;
} finally {
	await app.close();
}
