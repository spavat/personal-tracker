import type { FastifyInstance } from "fastify";

import { SaveModelBodyRequest } from "@shared/dist/schemas/show.schema";
import { eq } from "drizzle-orm";

import { showArtist, showModel, showModelRole } from "../../../db/schema";

export class ModelRepository {
	constructor(private db: FastifyInstance["db"]) {}

	runInTransaction<T>(fn: (tx: any) => Promise<T>) {
		return this.db.transaction(fn);
	}

	findByIdWithDetails(id: number) {
		return this.db.query.showModel.findFirst({
			where: { id },
			with: {
				spectacle: true,
				roles: {
					orderBy: (role, { asc }) => [asc(role.order)],
					with: {
						artist: true,
					},
				},
			},
		});
	}

	deleteModelRoles(tx: any, modelId: number) {
		return tx.delete(showModelRole).where(eq(showModelRole.modelId, modelId));
	}

	updateModel(tx: any, id: number, data: SaveModelBodyRequest) {
		return tx.update(showModel).set(data).where(eq(showModel.id, id));
	}

	insertModel(tx: any, data: SaveModelBodyRequest) {
		return tx.insert(showModel).values(data).returning({ id: showModel.id });
	}

	insertArtist(tx: any, name: string) {
		return tx.insert(showArtist).values({ name }).returning({ id: showArtist.id });
	}

	insertModelRole(tx: any, data: any) {
		return tx.insert(showModelRole).values(data).returning({ id: showModelRole.id });
	}

	deleteModel(tx: any, id: number) {
		return tx.delete(showModel).where(eq(showModel.id, id));
	}
}
