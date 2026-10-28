import type { FastifyInstance } from "fastify";

import { eq } from "drizzle-orm";

import type { SaveWorkBody } from "./work.entity";

import { showWork } from "../../../db/schema";
import { placeNameAt } from "../places/place.repository";

export class WorkRepository {
	constructor(private db: FastifyInstance["db"]) {}

	findAll() {
		return this.db.query.showWork.findMany({
			orderBy: { name: "asc" },
		});
	}

	findAllWithSpectaclesPerformancesAndPlaces() {
		return this.db.query.showWork.findMany({
			with: {
				spectacle: {
					with: {
						performance: {
							extras: { placeName: placeNameAt },
							with: {
								place: true,
							},
						},
					},
				},
			},
		});
	}

	findByIdWithSpectacles(id: number) {
		return this.db.query.showWork.findFirst({
			where: { id },
			with: {
				spectacle: true,
			},
		});
	}

	async save(data: SaveWorkBody) {
		if (data.id) {
			await this.db.update(showWork).set(data).where(eq(showWork.id, data.id));
		} else {
			await this.db.insert(showWork).values(data);
		}
	}

	delete(id: number) {
		return this.db.delete(showWork).where(eq(showWork.id, id));
	}
}
