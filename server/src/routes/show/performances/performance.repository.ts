import type { FastifyInstance } from "fastify";

import { and, asc, eq, gte, lt, notInArray, sql } from "drizzle-orm";

import { showPerformance, showPlace, showRole, showSpectacle, showWork } from "../../../db/schema";
import { placeNameAt } from "../places/place.repository";

export class PerformanceRepository {
	constructor(private db: FastifyInstance["db"]) {}

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
			})
			.from(showPerformance)
			.leftJoin(showPlace, eq(showPerformance.placeId, showPlace.id))
			.leftJoin(showSpectacle, eq(showPerformance.spectacleId, showSpectacle.id))
			.leftJoin(showRole, eq(showPerformance.id, showRole.performanceId))
			.where(where.length ? and(...where) : undefined)
			.groupBy(showPerformance.id, showSpectacle.id, showPlace.id)
			.orderBy(asc(showPerformance.date));
	}

	findByIdWithDetails(performanceId: number) {
		return this.db.query.showPerformance.findFirst({
			where: { id: performanceId },
			extras: { placeName: placeNameAt },
			with: {
				spectacle: {
					with: {
						models: {
							with: {
								roles: {
									orderBy: (role, { asc }) => [asc(role.order)],
								},
							},
						},
					},
				},
				place: true,
				role: {
					with: {
						artist: true,
					},
				},
			},
		});
	}

	insertPlace(tx: any, place: any) {
		return tx.insert(showPlace).values(place).returning({ id: showPlace.id });
	}

	insertWork(tx: any, work: any) {
		return tx.insert(showWork).values(work).returning({ id: showWork.id });
	}

	insertSpectacle(tx: any, spectacle: any) {
		return tx.insert(showSpectacle).values(spectacle).returning({ id: showSpectacle.id });
	}

	savePerformance(tx: any, performanceId: number | undefined, data: any) {
		if (performanceId) {
			return tx.update(showPerformance).set(data).where(eq(showPerformance.id, performanceId));
		}
		return tx.insert(showPerformance).values(data);
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
					artistId: sql`excluded.artist_id`,
					status: sql`excluded.status`,
					order: sql`excluded."order"`,
				},
			});
	}

	deleteRolesExcept(tx: any, performanceId: number, incomingIds: number[], insertedIds: number[]) {
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
