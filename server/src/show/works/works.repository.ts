import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import type { SaveWorkBody } from "./work.entity.js";

import { viewerIsOwner } from "../../common/request-context.js";
import { DRIZZLE } from "../../database/database.tokens.js";
import { Drizzle } from "../../database/drizzle.js";
import { showWork } from "../../database/schema.js";
import { hasVisiblePerformance, visiblePerformanceWhere } from "../performances/visible-performance.query.js";
import { placeNameAt } from "../places/places.repository.js";

@Injectable()
export class WorksRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

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

	// false for an unknown id
	async delete(id: number) {
		return (await this.db.delete(showWork).where(eq(showWork.id, id)).returning({ id: showWork.id })).length > 0;
	}
}
