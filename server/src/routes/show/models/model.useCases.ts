import type { SaveModelBodyRequest } from "@personal-tracker/shared/show";
import type { FastifyBaseLogger } from "fastify";

import type { ModelRepository } from "./model.repository";
export class GetModelUseCase {
	constructor(private repo: ModelRepository) {}

	execute(id: number, log: FastifyBaseLogger) {
		log.info("GetModelUseCase.execute");
		return this.repo.findByIdWithDetails(id);
	}
}

export class SaveModelUseCase {
	constructor(private repo: ModelRepository) {}

	async execute(data: SaveModelBodyRequest, log: FastifyBaseLogger) {
		log.info("SaveModelUseCase.execute");
		if (data) {
			await this.repo.runInTransaction(async (tx) => {
				if (data.id) {
					// UPDATE
					// Remove model roles
					await this.repo.deleteModelRoles(tx, data.id);
					// Add model roles
					await this.processRoleModel(tx, data.roles, data.id);
					// Update model
					await this.repo.updateModel(tx, data.id, data);
				} else {
					// Insert model
					const [result] = await this.repo.insertModel(tx, data);
					// Add model roles
					await this.processRoleModel(tx, data.roles, result.id);
				}
			});
		}

		return { ok: true };
	}

	private async processRoleModel(tx: any, roles: SaveModelBodyRequest["roles"], modelId: number) {
		for (const role of roles) {
			let artistId = null;
			if (role.artistId) {
				// artist exist
				artistId = role.artistId;
			} else if (role.artist) {
				// new artist
				const [newArtistId] = await this.repo.insertArtist(tx, role.artist);
				artistId = newArtistId.id;
			}
			await this.repo.insertModelRole(tx, { ...role, artistId, modelId });
		}
	}
}

export class DeleteModelUseCase {
	constructor(private repo: ModelRepository) {}

	async execute(id: number, log: FastifyBaseLogger) {
		log.info("DeleteModelUseCase.execute");
		await this.repo.runInTransaction(async (tx) => {
			await this.repo.deleteModelRoles(tx, id);
			await this.repo.deleteModel(tx, id);
		});

		return { ok: true };
	}
}
