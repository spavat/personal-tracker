import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import type { SaveModelBody } from "./model.entity.js";

import { DRIZZLE } from "../../database/database.tokens.js";
import { Drizzle } from "../../database/drizzle.js";
import { showModel, showModelRole } from "../../database/schema.js";

@Injectable()
export class ModelsRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

	runInTransaction<T>(fn: (tx: any) => Promise<T>) {
		return this.db.transaction(fn);
	}

	findByIdWithDetails(id: string) {
		return this.db.query.showModel.findFirst({
			where: { id },
			with: {
				spectacle: true,
				roles: {
					orderBy: (role, { asc }) => [asc(role.order)],
					with: {
						entity: true,
					},
				},
			},
		});
	}

	deleteModelRoles(tx: any, modelId: string) {
		return tx.delete(showModelRole).where(eq(showModelRole.modelId, modelId));
	}

	updateModel(tx: any, id: string, data: SaveModelBody) {
		return tx.update(showModel).set(data).where(eq(showModel.id, id)).returning();
	}

	insertModel(tx: any, data: SaveModelBody) {
		return tx.insert(showModel).values(data).returning();
	}

	insertModelRole(tx: any, data: any) {
		return tx.insert(showModelRole).values(data).returning({ id: showModelRole.id });
	}

	async deleteModel(tx: any, id: string) {
		return (await tx.delete(showModel).where(eq(showModel.id, id)).returning({ id: showModel.id })).length > 0;
	}
}
