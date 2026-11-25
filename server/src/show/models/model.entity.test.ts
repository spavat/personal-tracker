import { describe, expect, it } from "vitest";

import { toModelRoleView, toModelView } from "./model.entity.js";

const ROLE_ID = "00000000-0000-4000-8000-000000000004";
const MODEL_ID = "00000000-0000-4000-8000-000000000020";
const SPECTACLE_ID = "00000000-0000-4000-8000-000000000100";
const ENTITY_ID = "00000000-0000-4000-8000-000000000005";
const role = {
	id: ROLE_ID,
	name: "Lead",
	main: true,
	entityId: ENTITY_ID,
	modelId: MODEL_ID,
	order: 1,
	entity: { id: ENTITY_ID, name: "Callas" },
};

describe("toModelRoleView", () => {
	it("nests the artist", () => {
		expect(toModelRoleView(role)).toEqual({
			id: ROLE_ID,
			name: "Lead",
			main: true,
			order: 1,
			artist: { id: ENTITY_ID, name: "Callas" },
		});
	});

	it("keeps a role without artist", () => {
		expect(toModelRoleView({ ...role, entityId: null, entity: null }).artist).toBeNull();
	});
});

describe("toModelView", () => {
	it("maps the roles and drops the spectacle id", () => {
		expect(toModelView({ id: MODEL_ID, name: "Cast A", spectacleId: SPECTACLE_ID, roles: [role] })).toEqual({
			id: MODEL_ID,
			name: "Cast A",
			roles: [toModelRoleView(role)],
		});
	});
});
