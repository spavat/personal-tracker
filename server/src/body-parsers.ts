import type { NestNodeApplication } from "@nestjs/platform-node";

// The adapter's limit is 100kb and global (no per-route limit as in Fastify). Called before `init()`, by main.ts and the test app.
export function configureBodyParsers(app: NestNodeApplication) {
	// a GPX file sent to /sport/save, or a book cover sent as a base64 data URI, can reach several MB
	app.useBodyParser("json", { limit: "15mb" });
	// AntennaPod backups sent to /internet/sync/upload are raw SQLite files (application/octet-stream), a Buffer body
	app.useBodyParser("raw", { limit: "200mb" });
}
