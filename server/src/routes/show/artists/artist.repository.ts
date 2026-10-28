import type { FastifyInstance } from "fastify";

import { SaveArtistBodyRequest } from "@shared/dist/schemas/show.schema";
import { AnyColumn, asc, desc, eq, getColumns, sql, SQL } from "drizzle-orm";

import { contains } from "../../../db/contains";
import { showArtist, showPerformance, showRole } from "../../../db/schema";
import { placeNameAt } from "../places/place.repository";

export class ArtistRepository {
	constructor(private db: FastifyInstance["db"]) {}

	findAll({ sortField, sortDirection }: { sortField: string; sortDirection: string }) {
		const sortFn = sortDirection === "asc" ? asc : desc;

		// Cannot sort with an alias column,
		// so we keep the whole SQL count definition for the sort
		const colNbPerformances = sql<number>`count(${showPerformance.id})`.mapWith(Number);
		const colNbSpectacles = sql<number>`count(distinct(${showPerformance.spectacleId}))`.mapWith(Number);
		let sortValue: AnyColumn | SQL<number> | null = null;
		if (sortField === "name") {
			sortValue = showArtist.name;
		} else if (sortField === "nbPerformances") {
			sortValue = colNbPerformances;
		} else if (sortField === "nbSpectacles") {
			sortValue = colNbSpectacles;
		}

		return this.db
			.select({
				...getColumns(showArtist),
				nbPerformances: colNbPerformances.as("nbPerformances"),
				nbSpectacles: colNbSpectacles.as("nbSpectacles"),
			})
			.from(showArtist)
			.leftJoin(showRole, eq(showRole.artistId, showArtist.id))
			.leftJoin(showPerformance, eq(showPerformance.id, showRole.performanceId))
			.groupBy(showArtist.id)
			.orderBy(sortFn(sql`${sortValue}`));
	}

	async findByIdWithPerformances(artistId: number) {
		const artist = await this.db.query.showArtist.findFirst({
			where: { id: artistId },
			with: {
				role: {
					with: {
						performance: {
							orderBy: (performance, { asc }) => [asc(performance.date)],
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

		artist?.role.sort((a, b) => (a.performance?.date ?? "").localeCompare(b.performance?.date ?? ""));

		return artist;
	}

	findByName(search: string) {
		return this.db.query.showArtist.findMany({
			where: {
				RAW: (t) => contains(t.name, search),
			},
			with: {
				role: {
					with: {
						performance: true,
					},
				},
			},
		});
	}

	async save(data: SaveArtistBodyRequest) {
		if (data.id) {
			await this.db.update(showArtist).set(data).where(eq(showArtist.id, data.id));
		} else {
			await this.db.insert(showArtist).values(data);
		}
	}

	delete(id: number) {
		return this.db.delete(showArtist).where(eq(showArtist.id, id));
	}
}
