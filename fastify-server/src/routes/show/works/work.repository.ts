import type { FastifyInstance } from "fastify";

import { eq } from "drizzle-orm";

import type { SaveWorkBody } from "./work.entity";

import { showWork } from "../../../db/schema";
import { hasVisiblePerformance, visiblePerformanceWhere } from "../../../db/visible-performance";
import { viewerIsOwner } from "../../../request-context";
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
			where: viewerIsOwner() ? {} : { spectacle: hasVisiblePerformance() },
			with: {
				spectacle: {
					where: hasVisiblePerformance(),
					with: {
						performance: {
							where: visiblePerformanceWhere(),
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

	// undefined when updating an unknown id
	async save(data: SaveWorkBody) {
		const [work] = data.id
			? await this.db.update(showWork).set(data).where(eq(showWork.id, data.id)).returning()
			: await this.db.insert(showWork).values(data).returning();
		return work;
	}

	delete(id: number) {
		return this.db.delete(showWork).where(eq(showWork.id, id));
	}
}
