import { Inject, Injectable } from "@nestjs/common";
import { and, AnyColumn, asc, desc, eq, isNotNull, sql, SQL } from "drizzle-orm";

import type { Tx } from "../../database/node.query.js";

import { contains } from "../../database/contains.query.js";
import { DRIZZLE } from "../../database/database.tokens.js";
import { Drizzle } from "../../database/drizzle.js";
import {
	coreEntity,
	showModel,
	showModelRole,
	showPerformance,
	showRole,
	showSpectacle,
} from "../../database/schema.js";
import {
	hasVisiblePerformance,
	visiblePerformanceDate,
	visibleSpectacle,
} from "../performances/visible-performance.query.js";
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

	// Per entity credited in a show: its spectacles (through a performance or a cast model) and its performances, the
	// ones a visitor may see. entityId: only this one.
	async countEntityCredits(entityId?: string) {
		const spectacleIds = (column: AnyColumn) => sql<string[]>`array_agg(distinct ${column})::text[]`;
		const [roles, modelRoles] = await Promise.all([
			this.db
				.select({
					entityId: showRole.entityId,
					spectacleIds: spectacleIds(showPerformance.spectacleId),
					nbPerformances: sql<number>`count(distinct ${showPerformance.id})::int`,
				})
				.from(showRole)
				.innerJoin(
					showPerformance,
					and(eq(showPerformance.id, showRole.performanceId), visiblePerformanceDate(showPerformance.date)),
				)
				.where(entityId ? eq(showRole.entityId, entityId) : isNotNull(showRole.entityId))
				.groupBy(showRole.entityId),
			this.db
				.select({ entityId: showModelRole.entityId, spectacleIds: spectacleIds(showModel.spectacleId) })
				.from(showModelRole)
				.innerJoin(showModel, eq(showModel.id, showModelRole.modelId))
				.where(
					and(
						visibleSpectacle(showModel.spectacleId),
						entityId ? eq(showModelRole.entityId, entityId) : isNotNull(showModelRole.entityId),
					),
				)
				.groupBy(showModelRole.entityId),
		]);
		const credits = new Map<string, { spectacleIds: Set<string>; nbPerformances: number }>();
		const creditsOf = (id: string) =>
			credits.get(id) ?? credits.set(id, { spectacleIds: new Set(), nbPerformances: 0 }).get(id)!;
		for (const row of roles) {
			const entry = creditsOf(row.entityId!);
			row.spectacleIds.forEach((id) => entry.spectacleIds.add(id));
			entry.nbPerformances = row.nbPerformances;
		}
		for (const row of modelRoles) {
			const entry = creditsOf(row.entityId!);
			row.spectacleIds.forEach((id) => entry.spectacleIds.add(id));
		}
		return new Map(
			[...credits].map(([id, { spectacleIds: ids, nbPerformances }]) => [
				id,
				{ spectacles: ids.size, performances: nbPerformances },
			]),
		);
	}

	// The artist's roles in the spectacles' cast models, by spectacle then model; a visitor only gets the spectacles
	// with a visible performance
	findModelRoles(entityId: string) {
		return this.db
			.select({
				id: showModelRole.id,
				role: showModelRole.name,
				model: showModel.name,
				spectacleId: showSpectacle.id,
				spectacleName: showSpectacle.name,
			})
			.from(showModelRole)
			.innerJoin(showModel, eq(showModel.id, showModelRole.modelId))
			.innerJoin(showSpectacle, eq(showSpectacle.id, showModel.spectacleId))
			.where(and(eq(showModelRole.entityId, entityId), visibleSpectacle(showModel.spectacleId)))
			.orderBy(asc(showSpectacle.name), asc(showModel.name), asc(showModelRole.order));
	}

	// A merge: the roles of an entity (in performances and cast models) go to another one
	async moveEntityCredits(tx: Tx, fromId: string, toId: string) {
		await tx.update(showRole).set({ entityId: toId }).where(eq(showRole.entityId, fromId));
		await tx.update(showModelRole).set({ entityId: toId }).where(eq(showModelRole.entityId, fromId));
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
