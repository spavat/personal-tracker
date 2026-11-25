import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gte, lt, notInArray, sql } from "drizzle-orm";

import { DRIZZLE } from "../../database/database.tokens.js";
import { Drizzle } from "../../database/drizzle.js";
import { createNode } from "../../database/node.query.js";
import {
	showPerformance,
	showPlace,
	showRole,
	showSpectacle,
	showSpectacleMedia,
	showWork,
} from "../../database/schema.js";
import { placeNameAt } from "../places/places.repository.js";
import { visiblePerformanceWhere } from "./visible-performance.query.js";

@Injectable()
export class PerformancesRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

	runInTransaction<T>(fn: (tx: any) => Promise<T>) {
		return this.db.transaction(fn);
	}

	findAll({ from, to }: { from?: string; to?: string } = {}) {
		const where = [];
		if (from) {
			const fromDate = Temporal.PlainDate.from(from);
			const startOfDay = fromDate.toPlainDateTime();
			where.push(gte(showPerformance.date, startOfDay.toString()));
		}
		if (to) {
			const toDate = Temporal.PlainDate.from(to);
			const nextDay = toDate.add({ days: 1 }).toPlainDateTime();
			where.push(lt(showPerformance.date, nextDay.toString()));
		}

		return this.db
			.select({
				id: showPerformance.id,
				spectacle: showSpectacle.name,
				spectacleId: showSpectacle.id,
				place: placeNameAt(showPerformance),
				placeId: showPlace.id,
				date: showPerformance.date,
				country: showPlace.country,
				canceled: showPerformance.canceled,
				seat: showPerformance.seat,
				hasCasting: sql<boolean>`count(${showRole.id}) > 0`,
				casting_status: showPerformance.casting_status,
				casting_origin: showPerformance.casting_origin,
				posterId: showPerformance.posterId,
			})
			.from(showPerformance)
			.leftJoin(showPlace, eq(showPerformance.placeId, showPlace.id))
			.leftJoin(showSpectacle, eq(showPerformance.spectacleId, showSpectacle.id))
			.leftJoin(showRole, eq(showPerformance.id, showRole.performanceId))
			.where(where.length ? and(...where) : undefined)
			.groupBy(showPerformance.id, showSpectacle.id, showPlace.id)
			.orderBy(asc(showPerformance.date));
	}

	findAllWithDetails({
		from,
		to,
		sortDirection = "asc",
		excludeCanceled = false,
		limit,
	}: {
		from?: string;
		to?: string;
		sortDirection?: "asc" | "desc";
		excludeCanceled?: boolean;
		limit?: number;
	} = {}) {
		const date: { gte?: string; lt?: string } = {};
		if (from) {
			const fromDate = Temporal.PlainDate.from(from);
			date.gte = fromDate.toPlainDateTime().toString();
		}
		if (to) {
			const toDate = Temporal.PlainDate.from(to);
			date.lt = toDate.add({ days: 1 }).toPlainDateTime().toString();
		}

		return this.db.query.showPerformance.findMany({
			where: { date, ...(excludeCanceled && { canceled: false }), ...visiblePerformanceWhere() },
			orderBy: { date: sortDirection },
			...(limit && { limit }),
			extras: { placeName: placeNameAt },
			with: {
				place: true,
				spectacle: true,
				role: {
					with: { entity: true },
				},
			},
		});
	}

	findByIdWithDetails(performanceId: string) {
		return this.db.query.showPerformance.findFirst({
			where: { id: performanceId, ...visiblePerformanceWhere() },
			extras: { placeName: placeNameAt },
			with: {
				spectacle: {
					with: {
						models: {
							with: {
								roles: {
									orderBy: (role, { asc }) => [asc(role.order)],
									with: { entity: true },
								},
							},
						},
					},
				},
				place: true,
				role: {
					with: {
						entity: true,
					},
				},
			},
		});
	}

	async findSpectacleMediaKind(tx: any, spectacleId: string, mediaId: string) {
		const [link] = await tx
			.select({ kind: showSpectacleMedia.kind })
			.from(showSpectacleMedia)
			.where(and(eq(showSpectacleMedia.spectacleId, spectacleId), eq(showSpectacleMedia.mediaId, mediaId)));
		return link?.kind;
	}

	async insertPlace(tx: any, place: any): Promise<string> {
		const id = await createNode(tx, { type: "show_place", label: place.name });
		await tx.insert(showPlace).values({ ...place, id });
		return id;
	}

	async insertWork(tx: any, work: any): Promise<string> {
		const id = await createNode(tx, { type: "show_work", label: work.name });
		await tx.insert(showWork).values({ ...work, id });
		return id;
	}

	async insertSpectacle(tx: any, spectacle: any): Promise<string> {
		const id = await createNode(tx, { type: "show_spectacle", label: spectacle.name });
		await tx.insert(showSpectacle).values({ ...spectacle, id });
		return id;
	}

	savePerformance(tx: any, performanceId: string | undefined, data: any) {
		if (performanceId) {
			return tx.update(showPerformance).set(data).where(eq(showPerformance.id, performanceId)).returning();
		}
		return tx.insert(showPerformance).values(data).returning();
	}

	insertRoles(tx: any, roles: any[]) {
		return tx.insert(showRole).values(roles).returning({ id: showRole.id });
	}

	upsertRoles(tx: any, roles: any[]) {
		return tx
			.insert(showRole)
			.values(roles)
			.onConflictDoUpdate({
				target: showRole.id,
				set: {
					name: sql`excluded.name`,
					main: sql`excluded.main`,
					entityId: sql`excluded.entity_id`,
					status: sql`excluded.status`,
					order: sql`excluded."order"`,
				},
			});
	}

	// the casting roles reference the performance: they go first
	async delete(tx: any, performanceId: string) {
		await tx.delete(showRole).where(eq(showRole.performanceId, performanceId));
		return tx.delete(showPerformance).where(eq(showPerformance.id, performanceId)).returning();
	}

	deleteRolesExcept(tx: any, performanceId: string, incomingIds: string[], insertedIds: string[]) {
		return tx
			.delete(showRole)
			.where(
				and(
					notInArray(showRole.id, incomingIds),
					notInArray(showRole.id, insertedIds),
					eq(showRole.performanceId, performanceId),
				),
			);
	}
}
