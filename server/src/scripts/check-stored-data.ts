// Checks the stored documents against the response schemas, before deploying a route that serializes them: a
// document the schema refuses answers a 500. Prints each refused document with its issues, exits 1 when there is one.
// Usage, from server/ after a build: npm run check-stored-data (in production: docker compose exec server npm run check-stored-data)
import { ProgramSchema } from "@personal-tracker/shared/internet";
import { MongoClient } from "mongodb";
import * as z from "zod";

import { envSchema } from "../config/env.schema.js";

// collection -> the schema each of its documents is answered with
const CHECKS: Array<[collection: string, schema: z.ZodType]> = [["internet", ProgramSchema]];

const { MONGODB_URL } = envSchema.pick({ MONGODB_URL: true }).parse(process.env);
const client = new MongoClient(MONGODB_URL);

let refused = 0;
try {
	for (const [collection, schema] of CHECKS) {
		const documents = await client
			.db()
			.collection(collection)
			.find({}, { projection: { _id: 0 } })
			.toArray();
		for (const document of documents) {
			const result = schema.safeParse(document);
			if (!result.success) {
				refused++;
				console.log(`${collection} ${document.id} (${document.name ?? ""}):`);
				for (const issue of result.error.issues) {
					console.log(`  ${issue.path.join(".")}: ${issue.message}`);
				}
			}
		}
		console.log(`${collection}: ${documents.length} documents checked`);
	}
} finally {
	await client.close();
}
console.log(refused ? `${refused} documents refused` : "every document passes");
process.exit(refused ? 1 : 0);
