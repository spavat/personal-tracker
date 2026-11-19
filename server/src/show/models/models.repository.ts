import { Inject, Injectable } from "@nestjs/common";
import { SaveModelBodyRequest } from "@personal-tracker/shared/show";
import { eq } from "drizzle-orm";

import { DRIZZLE } from "../../database/database.tokens.js";
import { Drizzle } from "../../database/drizzle.js";
import { showArtist, showModel, showModelRole } from "../../database/schema.js";

@Injectable()
export class ModelsRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

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
		return tx.update(showModel).set(data).where(eq(showModel.id, id)).returning();
	}

	insertModel(tx: any, data: SaveModelBodyRequest) {
		return tx.insert(showModel).values(data).returning();
	}

	insertArtist(tx: any, name: string) {
		return tx.insert(showArtist).values({ name }).returning({ id: showArtist.id });
	}

	insertModelRole(tx: any, data: any) {
		return tx.insert(showModelRole).values(data).returning({ id: showModelRole.id });
	}

	// false for an unknown id
	async deleteModel(tx: any, id: number) {
		return (await tx.delete(showModel).where(eq(showModel.id, id)).returning({ id: showModel.id })).length > 0;
	}
}
