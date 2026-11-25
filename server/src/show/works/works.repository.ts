import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import type { SaveWorkBody } from "./work.entity.js";

import { viewerIsOwner } from "../../common/request-context.js";
import { DRIZZLE } from "../../database/database.tokens.js";
import { Drizzle } from "../../database/drizzle.js";
import { createNode, renameNode } from "../../database/node.query.js";
import { coreNode, showWork } from "../../database/schema.js";
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

	findByIdWithSpectacles(id: string) {
		return this.db.query.showWork.findFirst({
			where: { id },
			with: {
				spectacle: true,
			},
		});
	}

	save({ id, ...data }: SaveWorkBody) {
		return this.db.transaction(async (tx) => {
			if (id) {
				const [work] = await tx.update(showWork).set(data).where(eq(showWork.id, id)).returning();
				if (work) await renameNode(tx, id, work.name);
				return work;
			}
			const nodeId = await createNode(tx, { type: "show_work", label: data.name });
			const [work] = await tx
				.insert(showWork)
				.values({ ...data, id: nodeId })
				.returning();
			return work;
		});
	}

	async delete(id: string) {
		const deleted = await this.db
			.delete(coreNode)
			.where(and(eq(coreNode.id, id), eq(coreNode.type, "show_work")))
			.returning({ id: coreNode.id });
		return deleted.length > 0;
	}
}
