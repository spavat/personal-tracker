import type { FastifyInstance } from "fastify";

import { AnyColumn, asc, desc, eq, getColumns, sql, SQL } from "drizzle-orm";

import type { SavePlaceBody } from "./place.entity";

import { contains } from "../../../db/contains";
import { showPerformance, showPlace, showPlaceFormerName } from "../../../db/schema";

// Name of the place at the time of the performance:
// the earliest former name still valid at that date, otherwise the latest name.
// Self-contained (no join needed) so it can be used in RQB extras too.
export function placeNameAt(performance: { placeId: AnyColumn; date: AnyColumn }) {
	return sql<string>`coalesce(
		(select ${showPlaceFormerName.name} from ${showPlaceFormerName}
			where ${showPlaceFormerName.placeId} = ${performance.placeId} and ${showPlaceFormerName.untilDate} > ${performance.date}
			order by ${showPlaceFormerName.untilDate} limit 1),
		(select ${showPlace.name} from ${showPlace} where ${showPlace.id} = ${performance.placeId})
	)`;
}

export class PlaceRepository {
	constructor(private db: FastifyInstance["db"]) {}

	findAll({ sortField, sortDirection }: { sortField: string; sortDirection: string }) {
		const sortFn = sortDirection === "asc" ? asc : desc;

		// Cannot sort with an alias column,
		// so we keep the whole SQL count definition for the sort
		// Canceled performances aren't counted, as in the place details
		const colNbPerformances =
			sql<number>`count(${showPerformance.id}) filter (where not ${showPerformance.canceled})`.mapWith(Number);
		const colNbSpectacles =
			sql<number>`count(distinct(${showPerformance.spectacleId})) filter (where not ${showPerformance.canceled})`.mapWith(
				Number,
			);
		let sortValue: AnyColumn | SQL<number> | null = null;
		if (sortField === "name") {
			sortValue = showPlace.name;
		} else if (sortField === "country") {
			sortValue = showPlace.country;
		} else if (sortField === "nbPerformances") {
			sortValue = colNbPerformances;
		} else if (sortField === "nbSpectacles") {
			sortValue = colNbSpectacles;
		}

		return this.db
			.select({
				...getColumns(showPlace),
				nbPerformances: colNbPerformances.as("nbPerformances"),
				nbSpectacles: colNbSpectacles.as("nbSpectacles"),
			})
			.from(showPlace)
			.leftJoin(showPerformance, eq(showPerformance.placeId, showPlace.id))
			.groupBy(showPlace.id)
			.orderBy(sortFn(sql`${sortValue}`));
	}

	findByIdWithPerformances(placeId: number) {
		return this.db.query.showPlace.findFirst({
			where: { id: placeId },
			with: {
				formerNames: {
					orderBy: (formerName, { asc }) => [asc(formerName.untilDate)],
				},
				performance: {
					orderBy: (performance, { asc }) => [asc(performance.date)],
					extras: { placeName: placeNameAt },
					with: {
						spectacle: true,
						place: true,
					},
				},
			},
		});
	}

	findByName(search: string) {
		return this.db.query.showPlace.findMany({
			where: {
				OR: [
					{ RAW: (t) => contains(t.name, search) },
					{ formerNames: { RAW: (t) => contains(t.name, search) } },
				],
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

	save({ formerNames, ...data }: SavePlaceBody) {
		return this.db.transaction(async (tx) => {
			let placeId = data.id;
			if (placeId) {
				await tx.update(showPlace).set(data).where(eq(showPlace.id, placeId));
			} else {
				[{ id: placeId }] = await tx.insert(showPlace).values(data).returning({ id: showPlace.id });
			}

			// Former names are replaced as a whole
			await tx.delete(showPlaceFormerName).where(eq(showPlaceFormerName.placeId, placeId));
			if (formerNames.length) {
				await tx
					.insert(showPlaceFormerName)
					.values(formerNames.map((formerName) => ({ ...formerName, placeId })));
			}
		});
	}

	delete(id: number) {
		return this.db.delete(showPlace).where(eq(showPlace.id, id));
	}
}
