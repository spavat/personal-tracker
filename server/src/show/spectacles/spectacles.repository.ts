import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import type { SaveSpectacleBody } from "./spectacle.entity.js";

import { contains } from "../../database/contains.query.js";
import { DRIZZLE } from "../../database/database.tokens.js";
import { Drizzle } from "../../database/drizzle.js";
import { createNode, renameNode } from "../../database/node.query.js";
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

	findByIdWithDetails(id: string) {
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
								entity: true,
							},
						},
					},
				},
				models: {
					with: {
						roles: {
							orderBy: (role, { asc }) => [asc(role.order)],
							with: {
								entity: true,
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

	save({ models: _models, id, ...data }: SaveSpectacleBody) {
		return this.db.transaction(async (tx) => {
			if (id) {
				const [spectacle] = await tx
					.update(showSpectacle)
					.set(data)
					.where(eq(showSpectacle.id, id))
					.returning();
				if (spectacle) await renameNode(tx, id, spectacle.name);
				return spectacle;
			}
			const nodeId = await createNode(tx, { type: "show_spectacle", label: data.name });
			const [spectacle] = await tx
				.insert(showSpectacle)
				.values({ ...data, id: nodeId })
				.returning();
			return spectacle;
		});
	}
}
