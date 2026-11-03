import type { FastifyInstance } from "fastify";

import { eq } from "drizzle-orm";

import type { SaveSpectacleBody } from "./spectacle.entity";

import { contains } from "../../../db/contains";
import { showSpectacle } from "../../../db/schema";
import { placeNameAt } from "../places/place.repository";

export class SpectacleRepository {
	constructor(private db: FastifyInstance["db"]) {}

	findAll() {
		return this.db.query.showSpectacle.findMany({
			orderBy: { name: "asc" },
		});
	}

	findAllWithPerformancesAndPlaces() {
		return this.db.query.showSpectacle.findMany({
			with: {
				performance: {
					orderBy: { date: "asc" },
					extras: { placeName: placeNameAt },
					with: {
						place: true,
					},
				},
			},
		});
	}

	findByIdWithDetails(id: number) {
		return this.db.query.showSpectacle.findFirst({
			where: { id },
			with: {
				performance: {
					orderBy: { date: "asc" },
					extras: { placeName: placeNameAt },
					with: {
						place: true,
						role: {
							with: {
								artist: true,
							},
						},
					},
				},
				models: {
					with: {
						roles: {
							orderBy: (role, { asc }) => [asc(role.order)],
							with: {
								artist: true,
							},
						},
					},
				},
				mediaLinks: {
					with: { media: true },
				},
			},
		});
	}

	findByName(search: string) {
		return this.db.query.showSpectacle.findMany({
			where: {
				RAW: (t) => contains(t.name, search),
			},
			with: {
				performance: {
					with: {
						place: true,
					},
				},
			},
		});
	}

	// undefined when updating an unknown id
	async save({ models: _models, ...data }: SaveSpectacleBody) {
		const [spectacle] = data.id
			? await this.db.update(showSpectacle).set(data).where(eq(showSpectacle.id, data.id)).returning()
			: await this.db.insert(showSpectacle).values(data).returning();
		return spectacle;
	}
}
