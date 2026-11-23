import type { NestNodeApplication } from "@nestjs/platform-node";
import type { IncomingMessage, ServerResponse } from "node:http";

// the adapter's parsers (not re-exported by the package index)
import { json, raw } from "@nestjs/platform-node/body-parser/body-parser.js";

type Next = (error?: unknown) => void;
type Parser = (req: IncomingMessage, res: ServerResponse, next: Next) => void;

// The routes whose JSON carries a file: a base64 data URI (portrait, cover, picture, media) or a GPX text
const UPLOAD_ROUTES: Array<[method: string, path: RegExp]> = [
	["POST", /^\/sport\/activities$/],
	["PUT", /^\/sport\/activities\/[^/]+$/],
	["POST", /^\/entities$/],
	["PUT", /^\/entities\/[^/]+$/],
	["POST", /^\/reading-book\/books\/[^/]+\/editions$/],
	["PUT", /^\/reading-book\/books\/[^/]+\/editions\/[^/]+$/],
	["POST", /^\/show\/media\/(spectacles|artists)\/[^/]+$/],
	["POST", /^\/broadcast\/programs$/],
	["PUT", /^\/broadcast\/programs\/[^/]+$/],
	["POST", /^\/broadcast\/sync\/[^/]+\/validate$/],
	["POST", /^\/game\/games$/],
	["PUT", /^\/game\/games\/[^/]+$/],
];
// AntennaPod backups: raw SQLite files (application/octet-stream), a Buffer body
const BACKUP_ROUTE = /^\/broadcast\/sync\/upload$/;

const pathOf = (req: IncomingMessage) => (req.url ?? "").split("?")[0];
const isUpload = (req: IncomingMessage) =>
	UPLOAD_ROUTES.some(([method, path]) => req.method === method && path.test(pathOf(req)));

const smallJson: Parser = json({ limit: "100kb" });
const largeJson: Parser = json({ limit: "15mb" });
const backup: Parser = raw({ limit: "200mb" });

/**
 * The adapter's limit is global (no per-route limit as in Fastify): one JSON parser picks it by route, 15mb for the
 * uploads, 100kb elsewhere. Named `jsonParser`, the adapter's default one is then left out. Called before `init()`,
 * by main.ts and the test app.
 */
export function configureBodyParsers(app: NestNodeApplication) {
	app.use(function jsonParser(req: IncomingMessage, res: ServerResponse, next: Next) {
		(isUpload(req) ? largeJson : smallJson)(req, res, next);
	});
	app.use(function backupParser(req: IncomingMessage, res: ServerResponse, next: Next) {
		if (req.method === "POST" && BACKUP_ROUTE.test(pathOf(req))) {
			backup(req, res, next);
		} else {
			next();
		}
	});
}
