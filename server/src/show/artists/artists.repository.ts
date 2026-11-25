import { Inject, Injectable } from "@nestjs/common";
import { and, AnyColumn, asc, desc, eq, sql, SQL } from "drizzle-orm";

import { contains } from "../../database/contains.query.js";
import { DRIZZLE } from "../../database/database.tokens.js";
import { Drizzle } from "../../database/drizzle.js";
import { coreEntity, showModelRole, showPerformance, showRole } from "../../database/schema.js";
import { hasVisiblePerformance, visiblePerformanceDate } from "../performances/visible-performance.query.js";
import { placeNameAt } from "../places/places.repository.js";

// An artist is an entity credited in a show role or model role. Self-contained, for RQB RAW filters too.
function isShowCredited(entityId: AnyColumn) {
	return sql`(exists (select 1 from ${showRole} where ${showRole.entityId} = ${entityId})
		or exists (select 1 from ${showModelRole} where ${showModelRole.entityId} = ${entityId}))`;
}

@Injectable()
export class ArtistsRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

	findAll({ sortField, sortDirection }: { sortField: string; sortDirection: string }) {
		const sortFn = sortDirection === "asc" ? asc : desc;

		// Cannot sort with an alias column,
		// so we keep the whole SQL count definition for the sort
		const colNbPerformances = sql<number>`count(${showPerformance.id})`.mapWith(Number);
		const colNbSpectacles = sql<number>`count(distinct(${showPerformance.spectacleId}))`.mapWith(Number);
		let sortValue: AnyColumn | SQL<number> | null = null;
		if (sortField === "name") {
			sortValue = coreEntity.name;
		} else if (sortField === "nbPerformances") {
			sortValue = colNbPerformances;
		} else if (sortField === "nbSpectacles") {
			sortValue = colNbSpectacles;
		}

		return (
			this.db
				.select({
					id: coreEntity.id,
					name: coreEntity.name,
					pictureKey: coreEntity.pictureKey,
					nbPerformances: colNbPerformances.as("nbPerformances"),
					nbSpectacles: colNbSpectacles.as("nbSpectacles"),
				})
				.from(coreEntity)
				.leftJoin(showRole, eq(showRole.entityId, coreEntity.id))
				.leftJoin(
					showPerformance,
					and(eq(showPerformance.id, showRole.performanceId), visiblePerformanceDate(showPerformance.date)),
				)
				.where(isShowCredited(coreEntity.id))
				.groupBy(coreEntity.id)
				// ties by name: uuids give no creation order
				.orderBy(sortFn(sql`${sortValue}`), asc(coreEntity.name))
		);
	}

	async findByIdWithPerformances(entityId: string) {
		const artist = await this.db.query.coreEntity.findFirst({
			columns: { id: true, kind: true, name: true, sortName: true, pictureKey: true },
			where: { id: entityId },
			with: {
				showRoles: {
					where: hasVisiblePerformance(),
					with: {
						performance: {
							extras: { placeName: placeNameAt },
							with: {
								spectacle: true,
								place: true,
							},
						},
					},
				},
			},
		});

		artist?.showRoles.sort((a, b) => (a.performance?.date ?? "").localeCompare(b.performance?.date ?? ""));

		return artist;
	}

	findByName(search: string) {
		return this.db.query.coreEntity.findMany({
			columns: { id: true, name: true },
			where: {
				RAW: (t) => and(contains(t.name, search), isShowCredited(t.id))!,
			},
			with: {
				showRoles: {
					where: hasVisiblePerformance(),
					with: {
						performance: true,
					},
				},
			},
		});
	}
}
