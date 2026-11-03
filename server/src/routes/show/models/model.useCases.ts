import type { SaveModelBodyRequest } from "@personal-tracker/shared/show";
import type { FastifyBaseLogger } from "fastify";

import { httpErrors } from "@fastify/sensible";

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
		return this.repo.runInTransaction(async (tx) => {
			if (data.id) {
				// UPDATE
				// Update model (first: an unknown id rolls back before touching the roles)
				const [model] = await this.repo.updateModel(tx, data.id, data);
				if (!model) {
					throw httpErrors.notFound("Modèle introuvable");
				}
				// Remove model roles
				await this.repo.deleteModelRoles(tx, data.id);
				// Add model roles
				await this.processRoleModel(tx, data.roles, data.id);
				return model;
			}
			// Insert model
			const [model] = await this.repo.insertModel(tx, data);
			// Add model roles
			await this.processRoleModel(tx, data.roles, model.id);
			return model;
		});
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
	}
}
