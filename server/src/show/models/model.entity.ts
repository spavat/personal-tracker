import type { ModelRoleView, ModelView, SaveModelBodyRequest } from "@personal-tracker/shared/show";

import type { showArtist, showModel, showModelRole } from "../../database/schema.js";

// the body, with the id of the path on an update (none: created)
export type SaveModelBody = SaveModelBodyRequest & { id?: number };

// Rows of the relational queries: model with { roles: { with: { artist } } }
type ModelRoleRow = typeof showModelRole.$inferSelect & { artist: typeof showArtist.$inferSelect | null };
type ModelRow = typeof showModel.$inferSelect & { roles: Array<ModelRoleRow> };

export function toModelRoleView(role: ModelRoleRow): ModelRoleView {
	return {
		id: role.id,
		name: role.name ?? "",
		main: role.main ?? false,
		order: role.order ?? 0,
		pictureId: role.pictureId,
		artist: role.artist && { id: role.artist.id, name: role.artist.name ?? "" },
	};
}

export function toModelView(model: ModelRow): ModelView {
	return {
		id: model.id,
		name: model.name,
		roles: model.roles.map(toModelRoleView),
	};
}
