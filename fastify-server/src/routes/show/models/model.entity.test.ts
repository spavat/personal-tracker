import { describe, expect, it } from "vitest";

import { toModelRoleView, toModelView } from "./model.entity";

const role = {
	id: 4,
	name: "Lead",
	main: true,
	artistId: 5,
	modelId: 20,
	order: 1,
	pictureId: null,
	artist: { id: 5, name: "Callas", pictureId: null },
};

describe("toModelRoleView", () => {
	it("nests the artist", () => {
		expect(toModelRoleView(role)).toEqual({
			id: 4,
			name: "Lead",
			main: true,
			order: 1,
			pictureId: null,
			artist: { id: 5, name: "Callas" },
		});
	});

	it("keeps a role without artist", () => {
		expect(toModelRoleView({ ...role, artistId: null, artist: null }).artist).toBeNull();
	});
});

describe("toModelView", () => {
	it("maps the roles and drops the spectacle id", () => {
		expect(toModelView({ id: 20, name: "Cast A", spectacleId: 100, roles: [role] })).toEqual({
			id: 20,
			name: "Cast A",
			roles: [toModelRoleView(role)],
		});
	});
});
