import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import type { SaveSpectacleBody } from "./spectacle.entity.js";

import { contains } from "../../database/contains.query.js";
import { DRIZZLE } from "../../database/database.tokens.js";
import { Drizzle } from "../../database/drizzle.js";
import { showSpectacle } from "../../database/schema.js";
import { hasVisiblePerformance, visiblePerformanceWhere } from "../performances/visible-performance.query.js";
import { placeNameAt } from "../places/places.repository.js";

@Injectable()
export class SpectaclesRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

	findAll() {
		return this.db.query.showSpectacle.findMany({
			orderBy: { name: "asc" },
		});
	}

	findAllWithPerformancesAndPlaces() {
		return this.db.query.showSpectacle.findMany({
			where: hasVisiblePerformance(),
			with: {
				performance: {
					where: visiblePerformanceWhere(),
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
			where: { id, ...hasVisiblePerformance() },
			with: {
				performance: {
					where: visiblePerformanceWhere(),
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
				...hasVisiblePerformance(),
			},
			with: {
				performance: {
					where: visiblePerformanceWhere(),
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
