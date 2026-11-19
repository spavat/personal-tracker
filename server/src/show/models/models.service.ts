import type { SaveModelBodyRequest } from "@personal-tracker/shared/show";

import { Injectable, Logger } from "@nestjs/common";

import { NotFoundError } from "../../common/errors.js";
import { ModelsRepository } from "./models.repository.js";
@Injectable()
export class ModelsService {
	private readonly logger = new Logger(ModelsService.name);

	constructor(private readonly repo: ModelsRepository) {}

	get(id: number) {
		this.logger.log("get");
		return this.repo.findByIdWithDetails(id);
	}

	async save(data: SaveModelBodyRequest) {
		this.logger.log("save");
		return this.repo.runInTransaction(async (tx) => {
			if (data.id) {
				// UPDATE
				// Update model (first: an unknown id rolls back before touching the roles)
				const [model] = await this.repo.updateModel(tx, data.id, data);
				if (!model) {
					throw new NotFoundError("model");
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

	async delete(id: number) {
		this.logger.log("delete");
		await this.repo.runInTransaction(async (tx) => {
			await this.repo.deleteModelRoles(tx, id);
			// an unknown id rolls back
			if (!(await this.repo.deleteModel(tx, id))) {
				throw new NotFoundError("model");
			}
		});
	}
}
