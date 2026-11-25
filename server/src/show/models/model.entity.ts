import type { ModelRoleView, ModelView, SaveModelBodyRequest } from "@personal-tracker/shared/show";

import type { coreEntity, showModel, showModelRole } from "../../database/schema.js";

// the body, with the id of the path on an update (none: created)
export type SaveModelBody = SaveModelBodyRequest & { id?: string };

// Rows of the relational queries: model with { roles: { with: { entity } } }
type ModelRoleRow = typeof showModelRole.$inferSelect & {
	entity: Pick<typeof coreEntity.$inferSelect, "id" | "name"> | null;
};
type ModelRow = typeof showModel.$inferSelect & { roles: Array<ModelRoleRow> };

export function toModelRoleView(role: ModelRoleRow): ModelRoleView {
	return {
		id: role.id,
		name: role.name ?? "",
		main: role.main ?? false,
		order: role.order ?? 0,
		artist: role.entity && { id: role.entity.id, name: role.entity.name },
	};
}

export function toModelView(model: ModelRow): ModelView {
	return {
		id: model.id,
		name: model.name,
		roles: model.roles.map(toModelRoleView),
	};
}
