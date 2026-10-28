import type { FastifyInstance } from "fastify";

import { contains } from "../../../db/contains";
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
}
